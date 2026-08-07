/* 服务器实时状态卡片组件（可嵌入任意 markdown：{{< server-status >}}）
 * 读取 <section id="server-status"> 内 <script type="application/json" id="server-status-config">
 * 中的配置，向状态 API 查询每台服务器并渲染独立卡片。
 * 每张卡片自带刷新按钮与更新时间，无统一标题头。
 * 默认 API：https://api.mcstatus.io/v2/status/java （1 分钟缓存，CORS 开放）
 */
(function () {
  'use strict';

  var section = null;
  var grid = null;
  var api = 'https://api.mcstatus.io/v2/status/java';
  var refreshInterval = 60;
  var servers = [];
  var results = new Map(); // key -> { status: 'loading'|'online'|'sleeping'|'offline'|'error', data, ts }
  var inflight = new Map(); // key -> Promise（同一台服务器并发请求共享同一个查询）
  var busy = false;

  /* 地址防爬虫：配置 JSON 里的 host 是替换表密文（见 partial server-status.html），
     PLAIN/CIPHER 逐字符一一对应，这里在浏览器端解码出明文用于 API 查询与复制。
     明文地址不会出现在 HTML 中；卡片默认以固定掩码显示，点击复制。 */
  var PLAIN = 'abcdefghijklmnopqrstuvwxyz0123456789.-';
  var CIPHER = 'QWERTYUIOPASDFGHJKLZXCVBNM@#$%^&*_+={}';
  var MASK = '••••••••••••••••'; // 16 个 •（密文占位）
  /* 静态 SVG 图标（固定字符串，无用户输入，innerHTML 安全） */
  var REFRESH_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  var COPY_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  var EYE_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function decodeHost(enc) {
    if (!enc || typeof enc !== 'string') return enc;
    var map = {};
    for (var i = 0; i < CIPHER.length; i++) map[CIPHER[i]] = PLAIN[i];
    var out = '';
    for (var j = 0; j < enc.length; j++) out += map[enc[j]] || enc[j];
    return out;
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try {
      document.execCommand('copy');
      done();
    } catch (e) {}
    document.body.removeChild(ta);
  }

  /* 复制服务器地址（明文 host[:port]）；成功后复制按钮切换为绿色对号 1.6s，纯图标无文字 */
  function copyAddress(server, copyBtn) {
    var text = server.host + (server.port !== 25565 ? ':' + server.port : '');
    function done() {
      copyBtn.innerHTML = CHECK_ICON;
      copyBtn.classList.add('is-copied');
      setTimeout(function () {
        copyBtn.innerHTML = COPY_ICON;
        copyBtn.classList.remove('is-copied');
      }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function joinLines(x) {
    return Array.isArray(x) ? x.join('\n') : (x || '');
  }

  function normalize(data) {
    var players = data.players || {};
    var version = data.version || {};
    var motd = data.motd || {};
    var motdClean = joinLines(motd.clean);
    var versionName = version.name_clean || version.name || (typeof version === 'string' ? version : '');

    /* 探活失败却 online=true 的异常态：Exaroton 停机服对 ping 返回
       version.protocol = -1（MOTD "Server not found." 或 "◉ Sleeping"）。
       此时服务器并不在运行，应归为非在线。若版本提示 Sleeping 则标记为休眠态，
       仍展示其休眠 MOTD 与图标（该站海外服自动停止，属常态）。 */
    var probeFailed = !!data.online && (
      version.protocol === -1 ||
      /error/i.test(versionName) ||
      /server not found/i.test(motdClean)
    );

    return {
      online: !!data.online && !probeFailed,
      sleeping: !!data.online && probeFailed && /sleeping/i.test(versionName),
      players: { online: players.online || 0, max: players.max || 0 },
      version: versionName,
      motdClean: motdClean,
      motdHtml: joinLines(motd.html),
      icon: data.icon || ''
    };
  }

  /* MOTD html 来自服务器（站点自身，基本可信），此处做纵深防御：
   * 只保留纯样式 span，其余标签降级为纯文本，剥掉 on* 事件与链接。 */
  function sanitizeMotdHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var allowed = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR']);
    tmp.querySelectorAll('*').forEach(function (node) {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(document.createTextNode(node.textContent));
        return;
      }
      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        if (name.indexOf('on') === 0 || name === 'href' || name === 'src') {
          node.removeAttribute(attr.name);
        }
      });
    });
    return tmp.innerHTML;
  }

  function buildUrl(server) {
    return api + '/' + server.host + (server.port !== 25565 ? ':' + server.port : '');
  }

  function fetchServer(server) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    return fetch(buildUrl(server), { cache: 'no-store', signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        clearTimeout(timer);
        var d = normalize(data);
        return { status: d.online ? 'online' : (d.sleeping ? 'sleeping' : 'offline'), data: d };
      })
      .catch(function () {
        clearTimeout(timer);
        return { status: 'error', data: null };
      });
  }

  function loadServer(server) {
    if (inflight.has(server.key)) return inflight.get(server.key);
    var p = fetchServer(server).then(function (res) {
      res.ts = Date.now();
      results.set(server.key, res);
      inflight.delete(server.key);
      return res;
    });
    inflight.set(server.key, p);
    return p;
  }

  function badgeText(status) {
    if (status === 'online') return '在线';
    if (status === 'sleeping') return '休眠中';
    if (status === 'offline') return '离线';
    if (status === 'error') return '获取失败';
    return '查询中';
  }

  function formatTime(ts) {
    if (!ts) return '更新于 --:--';
    var d = new Date(ts);
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    var ss = String(d.getSeconds()).padStart(2, '0');
    return '更新于 ' + hh + ':' + mm + ':' + ss;
  }

  function renderCard(server) {
    var res = results.get(server.key) || { status: 'loading', data: null };
    var card = document.createElement('article');
    card.className = 'server-status__card is-' + res.status;
    card.dataset.serverKey = server.key;

    /* ── 信息展示区 ── */
    /* 头部：图标 + 名称 + 状态徽标（状态标签 + 内嵌 ICON 刷新按钮，合一） */
    var head = document.createElement('div');
    head.className = 'server-status__card-head';

    var icon = document.createElement('img');
    icon.className = 'server-status__icon';
    icon.alt = '';
    if (res.data && res.data.icon) {
      icon.src = res.data.icon;
    } else {
      icon.classList.add('is-hidden');
    }
    head.appendChild(icon);

    var name = document.createElement('span');
    name.className = 'server-status__name';
    name.textContent = server.name;
    head.appendChild(name);

    /* 头部右侧：更新时间 + 状态徽标（带刷新），一目了然 */
    var headRight = document.createElement('div');
    headRight.className = 'server-status__head-right';

    var updated = document.createElement('span');
    updated.className = 'server-status__updated';
    updated.textContent = formatTime(res.ts);
    headRight.appendChild(updated);

    var badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'server-status__badge';
    badge.setAttribute('aria-label', '刷新状态');
    badge.title = '点击刷新';
    var dot = document.createElement('span');
    dot.className = 'server-status__dot';
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode(badgeText(res.status)));
    var refreshIco = document.createElement('span');
    refreshIco.className = 'server-status__refresh-ico';
    refreshIco.innerHTML = REFRESH_ICON;
    badge.appendChild(refreshIco);
    badge.addEventListener('click', function () {
      /* 点击立即进入加载态：图标旋转，返回后原地更新自然清除 */
      var host = badge.closest('.server-status__card');
      if (host) host.classList.add('is-loading');
      /* 并发点击由 inflight 去重；完成后用新数据原地更新该卡 */
      loadServer(server).then(function () { renderCardInPlace(server); });
    });
    headRight.appendChild(badge);

    head.appendChild(headRight);

    card.appendChild(head);

    /* 在线 / 休眠：版本 + 彩色 MOTD（休眠态跳过玩家数，0/容量无信息量） */
    if (res.status === 'online' || res.status === 'sleeping') {
      var parts = [];
      if (res.status === 'online' && res.data.players.max) {
        parts.push(res.data.players.online + '/' + res.data.players.max + ' 名玩家');
      }
      if (res.data.version) {
        parts.push('版本 ' + res.data.version);
      }
      if (parts.length) {
        var meta = document.createElement('div');
        meta.className = 'server-status__meta-line';
        parts.forEach(function (part) {
          var tag = document.createElement('span');
          tag.className = 'server-status__tag';
          tag.textContent = part;
          meta.appendChild(tag);
        });
        card.appendChild(meta);
      }
      if (res.data.motdHtml) {
        var motd = document.createElement('div');
        motd.className = 'server-status__motd';
        motd.innerHTML = sanitizeMotdHtml(res.data.motdHtml);
        card.appendChild(motd);
      } else if (res.data.motdClean) {
        var motdTxt = document.createElement('div');
        motdTxt.className = 'server-status__motd';
        motdTxt.textContent = res.data.motdClean;
        card.appendChild(motdTxt);
      }
    } else if (res.status === 'error') {
      var err = document.createElement('div');
      err.className = 'server-status__error';
      err.textContent = '无法获取状态';
      card.appendChild(err);
    }

    /* 说明文字（如海外服自动停止提示） */
    if (server.note) {
      var note = document.createElement('p');
      note.className = 'server-status__note';
      note.textContent = server.note;
      card.appendChild(note);
    }

    /* ── 用户操作区：地址复制（标签+复制按钮合一）+ 社区链接 ── */
    var actions = document.createElement('div');
    actions.className = 'server-status__actions';

    /* 统一地址显示控件：标签「服务器地址」+ 密文/明文切换（睁眼/闭眼）+ 图标复制按钮。
       默认掩码显示；睁眼按钮切换明文，复制按钮纯图标，复制完成绿色对号。 */
    var addressText = server.host + (server.port !== 25565 ? ':' + server.port : '');
    var addr = document.createElement('div');
    addr.className = 'server-status__addr';

    var label = document.createElement('span');
    label.className = 'server-status__addr-label';
    label.textContent = '服务器地址：';
    addr.appendChild(label);

    var text = document.createElement('span');
    text.className = 'server-status__addr-text';
    text.textContent = server.show ? addressText : MASK;
    addr.appendChild(text);

    var divider = document.createElement('span');
    divider.className = 'server-status__addr-divider';
    divider.setAttribute('aria-hidden', 'true');
    addr.appendChild(divider);

    var revealed = !!server.show;
    var eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'server-status__addr-eye';
    eye.title = revealed ? '隐藏服务器地址' : '显示服务器地址';
    eye.setAttribute('aria-label', eye.title);
    eye.setAttribute('aria-pressed', revealed ? 'true' : 'false');
    eye.innerHTML = revealed ? EYE_OFF_ICON : EYE_ICON;
    eye.addEventListener('click', function () {
      revealed = !revealed;
      text.textContent = revealed ? addressText : MASK;
      eye.innerHTML = revealed ? EYE_OFF_ICON : EYE_ICON;
      eye.title = revealed ? '隐藏服务器地址' : '显示服务器地址';
      eye.setAttribute('aria-label', eye.title);
      eye.setAttribute('aria-pressed', revealed ? 'true' : 'false');
    });
    addr.appendChild(eye);

    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'server-status__addr-copy';
    copy.title = '复制服务器地址';
    copy.setAttribute('aria-label', copy.title);
    copy.innerHTML = COPY_ICON;
    copy.addEventListener('click', function () { copyAddress(server, copy); });
    addr.appendChild(copy);

    actions.appendChild(addr);

    /* 社区链接（QQ 群 / QQ 频道 / Discord，公开信息无需加密） */
    if (server.links && server.links.length) {
      var links = document.createElement('div');
      links.className = 'server-status__links';
      server.links.forEach(function (lk) {
        var a = document.createElement('a');
        a.className = 'server-status__link';
        a.href = lk.url || '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = lk.label || lk.url;
        links.appendChild(a);
      });
      actions.appendChild(links);
    }

    card.appendChild(actions);
    return card;
  }

  function findCard(key) {
    for (var i = 0; i < grid.children.length; i++) {
      if (grid.children[i].dataset.serverKey === key) return grid.children[i];
    }
    return null;
  }

  function renderCardInPlace(server) {
    var card = renderCard(server);
    var old = findCard(server.key);
    if (!old) {
      grid.appendChild(card);
      return;
    }
    /* 原地更新：保留卡片节点，只换状态类与内容。
       若用 replaceWith 整卡换新，:hover 会在换卡瞬间重算（新节点先按未悬停
       translateY:0 渲染），再触发 transform transition 滑回 -2px，造成一次
       "落下又抬起"的渲染抖动。保留节点则 hover 状态不重置、过渡不触发。 */
    old.className = card.className;
    while (old.firstChild) old.removeChild(old.firstChild);
    while (card.firstChild) old.appendChild(card.firstChild);
  }

  function renderAll() {
    grid.textContent = '';
    servers.forEach(renderCardInPlace);
  }

  function loadAll() {
    if (busy) return Promise.resolve();
    busy = true;
    return Promise.all(servers.map(function (server) {
      return loadServer(server).then(function () { renderCardInPlace(server); });
    })).finally(function () {
      busy = false;
    });
  }

  function init() {
    /* 组件自包含后，同一页可能被多次引入导致脚本加载两次；
       只初始化一次，避免对同一区域重复轮询。 */
    if (window.__serverStatusInit) return;
    window.__serverStatusInit = true;
    section = document.getElementById('server-status');
    grid = document.querySelector('[data-server-status-grid]');
    var cfgEl = document.getElementById('server-status-config');
    if (!section || !grid || !cfgEl) return;

    var cfg;
    try {
      cfg = JSON.parse(cfgEl.textContent);
    } catch (e) {
      return;
    }

    /* refresh_interval=0 表示关闭自动刷新（仅手动） */
    refreshInterval = (cfg.refresh_interval > 0) ? cfg.refresh_interval : 0;
    api = String(cfg.api || 'https://api.mcstatus.io/v2/status/java').replace(/\/+$/, '');
    servers = (cfg.servers || []).map(function (s) {
      var host = decodeHost(s.host || '');
      var port = s.port || 25565;
      return {
        key: host + ':' + port,
        name: s.name || host,
        host: host,
        port: port,
        note: s.note || '',
        links: s.links || [],
        show: (typeof s.show_address === 'boolean') ? s.show_address : !!cfg.show_address
      };
    });
    if (!servers.length) return;

    renderAll();          // 先显示“查询中”占位，逐台异步更新
    loadAll();
    if (refreshInterval > 0) {
      setInterval(loadAll, refreshInterval * 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
