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
  var openPanels = new Map(); // key -> 当前展开的玩家列表面板节点（跨刷新保留）
  var addrReveals = new Map(); // key -> { java, bedrock, web } 地址明/密文状态（跨刷新保留）
  var busy = false;
  var tabsEl = null;        // Tab 栏节点（多服务器共用一块展示区域时创建）
  var tabsEnabled = false;   // 是否启用 Tab 切换（配置 tabs=true 且服务器数 > 1）
  var activeKey = null;      // 当前选中的服务器 key（跨刷新保留）
  var webClientUrl = '';     // 「在浏览器中玩」打开的客户端地址（配置 web_client_url，空=不显示按钮）

  /* 地址防爬虫：配置 JSON 里的 host 是替换表密文，明文地址不会出现在 HTML 中；
     卡片默认以固定掩码显示，点击复制。替换表由模板单点维护（partial
     server-status.html），经配置 JSON 的 cipher_plain / cipher_mapping 下发，
     这里在浏览器端按同一表解码出明文用于 API 查询与复制。 */
  var PLAIN_TABLE = '';  // 由配置 JSON 的 cipher_plain 提供
  var CIPHER_TABLE = ''; // 由配置 JSON 的 cipher_mapping 提供
  var MASK = '••••••••••'; // 10 个 •（密文占位）：窄卡（≤320px）也能单行展示不折行
  /* 静态 SVG 图标（固定字符串，无用户输入，innerHTML 安全） */
  var REFRESH_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  var COPY_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  var EYE_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  /* 浏览器窗口图标（「在浏览器中玩」按钮）：Lucide Icons `app-window`
     Copyright (c) Lucide Icons and Contributors — ISC License（可免费商用/修改/再分发，
     保留本声明即可）。来源 https://lucide.dev/icons/app-window
     原样内联为字符串，不额外请求外部资源。 */
  var BROWSER_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/></svg>';
  /* 「在浏览器中玩」按钮的副标题：点它会用官方深链直接进服，同时复制地址备用。
     （官方站支持 /play?joinServer=<wss>&version=<ver>，无需自托管客户端。） */
  var PLAY_SUB_TEXT = '点击直接进服 · 同时复制地址备用';

  /* 玩家头像：mc-heads.net 按 UUID 返回方形头像（公开服务；玩家 UUID 本身公开，非敏感信息）。
     条目渲染时才按需加载，不进入配置 JSON。 */
  var PLAYER_AVATAR = 'https://mc-heads.net/avatar/';
  /* 基岩版状态 API：类型标签据数据判定——Java 状态接口不返回「是否支持基岩版」，
     需另查 bedrock 端点探活（只对配置了 bedrock 地址的服务器探测）。 */
  var BEDROCK_API = 'https://api.mcstatus.io/v2/status/bedrock';

  function decodeHost(enc) {
    if (!enc || typeof enc !== 'string') return enc;
    /* 表未就绪时原样返回（短代码正常渲染时配置必带替换表，不会走到这里） */
    if (!PLAIN_TABLE || !CIPHER_TABLE) return enc;
    var map = {};
    for (var i = 0; i < CIPHER_TABLE.length; i++) map[CIPHER_TABLE[i]] = PLAIN_TABLE[i];
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

  /* 复制文本（明文地址）；成功后复制按钮切换为「对号 + 已复制」绿色 1.6s。
     复制按钮为图标 + 文字结构（.copy-text），窄卡时文字由 CSS 隐藏只留图标。 */
  function copyText(text, copyBtn) {
    function setLabel(state) {
      copyBtn.innerHTML = (state === 'copied' ? CHECK_ICON : COPY_ICON)
        + '<span class="server-status__copy-text">' + (state === 'copied' ? '已复制' : '复制') + '</span>';
      copyBtn.classList.toggle('is-copied', state === 'copied');
    }
    function done() {
      setLabel('copied');
      setTimeout(function () { setLabel('idle'); }, 1600);
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
      players: { online: players.online || 0, max: players.max || 0, list: players.list || [] },
      version: versionName,
      protocol: version.protocol,   // 协议版本号，仅供排障；mcstatus 返回值不可信（常见 47），不上卡片
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

  /* 基岩版探活：并行探测 bedrock 端点，取回基岩端版本/协议（基岩版标签用，
     只取基岩端数据、与 Java 端不混用）。只对配置了 bedrock 地址的服务器探测；
     失败一律返回 null（视为非基岩），且不阻塞 Java 状态查询的渲染。 */
  function probeBedrock(server) {
    if (!server.bedrockHost) return Promise.resolve(null);
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, 4000);
    return fetch(BEDROCK_API + '/' + server.bedrockHost + ':' + server.bedrockPort, { cache: 'no-store', signal: c.signal })
      .then(function (res) {
        clearTimeout(t);
        return res.ok ? res.json() : null;
      })
      .then(function (d) {
        if (!d || !d.online) return null;
        /* 停机占位响应：Aternos/Exaroton 停机服的 bedrock 端点仍报 online=true，
           但 MOTD 是 "Offline" 之类占位文案，版本/协议为通用占位值——视为非在线，
           不渲染基岩版标签（与 Java 端 sleeping/offline 检测同思路）。 */
        var motdClean = (d.motd && d.motd.clean) || '';
        var versionName = (d.version && d.version.name) || '';
        if (/offline/i.test(motdClean) || /error/i.test(versionName)) return null;
        return {
          online: true,
          version: versionName,
          protocol: (d.version && d.version.protocol) || 0
        };
      })
      .catch(function () { return null; });
  }

  function fetchServer(server) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    var javaReq = fetch(buildUrl(server), { cache: 'no-store', signal: controller.signal })
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
    /* Java 状态与基岩版探活并行；探活结果（含基岩端版本/协议）并入本次结果 */
    return Promise.all([javaReq, probeBedrock(server)]).then(function (r) {
      return Object.assign({}, r[0], { bedrock: r[1] });
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

  /* 统一地址显示区（连接信息面板，2026-08 重设计）：
     顶部版本标签行（色点 + 标签）+ 地址值行（等宽地址 + 分隔线 + 睁眼 + 复制）。
     地址值用主文字色加粗、是面板的视觉重心；复制按钮带「复制」文字比纯图标更易发现；
     点击地址值本身也可复制（与复制按钮一致）。tone 决定标签行色点：
     'java' 绿 / 'bedrock' 蓝 / 'web' 紫 / 'generic' 灰。
     默认掩码显示；睁眼按钮切换明文；每枚面板独立明/密文状态（Java/基岩互不影响）。
     onToggle(revealed) 回调：切换明文时把状态写回 addrReveals，供刷新后恢复。 */
  function buildAddrPill(label, addressText, initiallyRevealed, onToggle, tone) {
    var addr = document.createElement('div');
    addr.className = 'server-status__addr';
    addr.dataset.tone = tone || 'generic';

    /* 顶部标签行：版本色点 + 标签文字 */
    var head = document.createElement('div');
    head.className = 'server-status__addr-head';

    var dot = document.createElement('span');
    dot.className = 'server-status__addr-dot';
    dot.setAttribute('aria-hidden', 'true');
    head.appendChild(dot);

    var lbl = document.createElement('span');
    lbl.className = 'server-status__addr-label';
    lbl.textContent = label;
    head.appendChild(lbl);

    addr.appendChild(head);

    /* 地址值行 */
    var body = document.createElement('div');
    body.className = 'server-status__addr-body';

    var text = document.createElement('span');
    text.className = 'server-status__addr-text';
    text.textContent = initiallyRevealed ? addressText : MASK;
    text.title = '点击复制服务器地址';
    text.tabIndex = 0;
    text.setAttribute('role', 'button');
    body.appendChild(text);

    var divider = document.createElement('span');
    divider.className = 'server-status__addr-divider';
    divider.setAttribute('aria-hidden', 'true');
    body.appendChild(divider);

    var revealed = !!initiallyRevealed;
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
      if (onToggle) onToggle(revealed);   // 写回 addrReveals，刷新后恢复明/密文
    });
    body.appendChild(eye);

    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'server-status__addr-copy';
    copy.title = '复制服务器地址';
    copy.setAttribute('aria-label', copy.title);
    copy.innerHTML = COPY_ICON + '<span class="server-status__copy-text">复制</span>';
    copy.addEventListener('click', function () { copyText(addressText, copy); });
    body.appendChild(copy);

    /* 点击 / 回车 地址值本身也复制（密文状态复制的也是明文，与复制按钮一致） */
    function copyOnAction(e) {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();   // 阻止空格滚动页面
      copyText(addressText, copy);
    }
    text.addEventListener('click', copyOnAction);
    text.addEventListener('keydown', copyOnAction);

    addr.appendChild(body);
    return addr;
  }

  /* 「在浏览器中玩」主操作按钮：整行、Web 端标识色填充，**一个 <a> 内两行文本**——
     主标题「在浏览器中玩」+ 副标题「点击会复制连接地址 · 到客户端「直连」粘贴」。
     副标题是「点它会顺手复制地址」的唯一提示：新标签打开后本页的临时反馈看不到，
     所以把提示做进按钮本身（整体仍是一个可点击区域，不额外占一行、关联最直接）。
     点击不阻止跳转（href 在新标签打开），同时把 wss:// 地址写进剪贴板，副标题短暂变
     「已复制地址，去粘贴」。 */
  /* 官方站深链：/play?joinServer=<wss地址>&version=<客户端版本>
     官方页会把 joinServer 传给客户端并直接进服（2026-11-22 实测首页服务器目录就是这种链接）。
     基础参数（如 version）沿用 web_client_url；逐服 web_version 可覆盖版本。 */
  function buildWebClientLink(addressText, version) {
    if (!webClientUrl) return '';
    var u;
    try { u = new URL(webClientUrl, window.location.href); } catch (err) { return webClientUrl; }
    if (addressText) u.searchParams.set('joinServer', addressText);
    if (version) u.searchParams.set('version', version);
    return u.toString();
  }

  function buildPlayBlock(addressText, clientVersion) {
    var playUrl = buildWebClientLink(addressText, clientVersion) || webClientUrl;
    var play = document.createElement('a');
    play.className = 'server-status__play';
    play.href = playUrl;
    play.target = '_blank';
    play.rel = 'noopener noreferrer';
    play.title = '新标签打开官方 Web 客户端并直接进服（同时复制地址备用）';

    /* 第一行：图标 + 主标题（同一行）；第二行：副标题（整行居中，不缩进到图标之后） */
    var head = document.createElement('span');
    head.className = 'server-status__play-head';
    head.innerHTML = BROWSER_ICON;

    var label = document.createElement('span');
    label.className = 'server-status__play-label';
    label.textContent = '在浏览器中玩';
    head.appendChild(label);

    var sub = document.createElement('span');
    sub.className = 'server-status__play-sub';
    sub.textContent = PLAY_SUB_TEXT;

    play.appendChild(head);
    play.appendChild(sub);

    play.addEventListener('click', function (e) {
      /* 显式在新标签打开：不依赖 `<a target>`（部分内置浏览器/WebView 会忽略它、直接在原页加载）。
         修饰键点击（Ctrl/⌘/Shift/中键）交给浏览器原生行为，不抢。 */
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var win = window.open(playUrl, '_blank');
      if (win) {
        e.preventDefault();   // 已在新标签打开 → 阻止锚点默认行为，原页面不跳转
        try { win.opener = null; } catch (err) {}   // 与 rel=noopener 同等隔离
      }
      /* window.open 被拦截时（返回 null）不 preventDefault，退回 <a target="_blank"> 默认行为 */

      function flash() {
        sub.textContent = '已复制地址备用';
        setTimeout(function () { sub.textContent = PLAY_SUB_TEXT; }, 3000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addressText).then(flash, flash);
      } else {
        fallbackCopy(addressText, flash);
      }
    });
    return play;
  }

  /* 取不到真实头像时回退 Steve/Alex 默认头像：按名称哈希稳定分配（同一玩家恒同一
     默认头像），保证两种默认头像都被用到，不会全是一张脸。 */
  function defaultHead(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PLAYER_AVATAR + (h % 2 === 0 ? 'Steve' : 'Alex') + '/24';
  }

  /* 玩家列表面板：点击「N/M 名玩家」标签时按需构建。条目 = 头像 + 名称。
     头像按 API 返回的 UUID 从 mc-heads.net 拉取（懒加载，默认皮肤的玩家会拿到
     对应 Steve/Alex 头）；无 UUID 或加载失败时回退到 Steve/Alex 默认头像。 */
  function buildPlayerList(list) {
    var panel = document.createElement('div');
    panel.className = 'server-status__players';
    list.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'server-status__player';

      var img = document.createElement('img');
      img.className = 'server-status__player-avatar';
      img.loading = 'lazy';
      img.alt = '';
      var name = p.name_clean || p.name_raw || '';
      var uuid = String(p.uuid || '').replace(/[^0-9a-fA-F-]/g, '');
      img.src = uuid ? (PLAYER_AVATAR + uuid + '/24') : defaultHead(name);
      img.addEventListener('error', function () {
        if (img.dataset.fb) { img.classList.add('is-empty'); return; } // 默认头像也失败才隐藏
        img.dataset.fb = '1';
        img.src = defaultHead(name);
      });
      row.appendChild(img);

      var nm = document.createElement('span');
      nm.className = 'server-status__player-name';
      nm.textContent = p.name_clean || p.name_raw || '玩家';
      row.appendChild(nm);

      panel.appendChild(row);
    });
    return panel;
  }

  function renderCard(server) {
    var res = results.get(server.key) || { status: 'loading', data: null };
    var card = document.createElement('article');
    card.className = 'server-status__card is-' + res.status;
    card.dataset.serverKey = server.key;
    /* Tab 模式：每张卡是一个 tabpanel，与上方 Tab 的 aria-controls 对应 */
    if (tabsEnabled) {
      card.id = 'server-status-panel-' + server.key;
      card.setAttribute('role', 'tabpanel');
      card.setAttribute('aria-labelledby', 'server-status-tab-' + server.key);
      card.tabIndex = 0;
    }

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

    /* meta 行：玩家数 / 版本 / 服务器类型 标签。类型标签恒显示（静态配置，离线也可见），
       玩家数与版本仅在拿到数据后显示（加载中/失败时该行只有类型标签）。 */
    var meta = document.createElement('div');
    meta.className = 'server-status__meta-line';

    /* 玩家数标签：在线且 API 返回了玩家列表（players.list 非空）时点击可展开玩家面板 */
    if (res.status === 'online' && res.data && res.data.players.max) {
      var plist = res.data.players.list || [];
      var pcount = res.data.players.online + '/' + res.data.players.max + ' 名玩家';
      if (plist.length) {
        var pbtn = document.createElement('button');
        pbtn.type = 'button';
        pbtn.className = 'server-status__tag server-status__players-toggle';
        pbtn.textContent = pcount;
        /* 面板节点存模块级 openPanels（按 server.key）：刷新后同一 Map 保留，
           新按钮的闭包也指向它——关闭/重开仍是同一面板（头像不重载）。 */
        if (openPanels.has(server.key)) pbtn.setAttribute('aria-expanded', 'true');
        pbtn.addEventListener('click', function () {
          /* 宿主卡用 closest 定位：renderCardInPlace 原地更新后，本闭包的 card/meta
             指向的是被搬空的临时节点（子节点已移入网格中的活卡），插入会抛
             NotFoundError。与徽标刷新同法——从按钮向上找真实卡片节点。 */
          var host = pbtn.closest('.server-status__card');
          var liveMeta = host ? host.querySelector('.server-status__meta-line') : null;
          if (!host || !liveMeta) return;
          var panel = openPanels.get(server.key);
          if (!panel) {
            panel = buildPlayerList(plist);   // 首次点击才构建（头像按需加载）
            panel.id = 'server-status-players-' + server.key; // 供 aria-controls 关联
            openPanels.set(server.key, panel);
          }
          if (panel.parentNode) {
            host.removeChild(panel);
            openPanels.delete(server.key);
          } else {
            host.insertBefore(panel, liveMeta.nextSibling); // 插在 meta-line 之后
          }
          var open = !!panel.parentNode;
          pbtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          pbtn.setAttribute('aria-controls', panel.id);
        });
        meta.appendChild(pbtn);
      } else {
        var ptag = document.createElement('span');
        ptag.className = 'server-status__tag';
        ptag.textContent = pcount;
        meta.appendChild(ptag);
      }
    }
    /* 类型标签拆分为 Java 版 / 基岩版 两个，各用自己端的版本号（不混用）：
       格式「类型 · 版本」，版本缺失则不渲染该标签；离线/获取失败不渲染。
       不显示协议号：mcstatus.io 的 version.protocol 不可信（对本服真实 762、
       国内服 Paper 26.3 均返回 47，Hypixel 也返回 47），显示出来是错误信息。
       仅休眠态（Java 端无可用版本号）回退为「版本 …」。 */
    if (res.status === 'online' && res.data) {
      var jParts = ['Java版'];
      if (res.data.version) jParts.push(res.data.version);
      if (jParts.length > 1) {
        var jtag = document.createElement('span');
        jtag.className = 'server-status__tag';
        jtag.textContent = jParts.join(' · ');
        meta.appendChild(jtag);
      }
    } else if (res.status === 'sleeping' && res.data && res.data.version) {
      var sver = document.createElement('span');
      sver.className = 'server-status__tag';
      sver.textContent = '版本 ' + res.data.version;
      meta.appendChild(sver);
    }
    if (res.bedrock && res.bedrock.online) {
      var bParts = ['基岩版'];
      if (res.bedrock.version) bParts.push(res.bedrock.version);
      if (bParts.length > 1) {
        var btag = document.createElement('span');
        btag.className = 'server-status__tag';
        btag.textContent = bParts.join(' · ');
        meta.appendChild(btag);
      }
    }

    if (meta.childNodes.length) {
      card.appendChild(meta);
    }

    /* 在线 / 休眠：彩色 MOTD（休眠态跳过玩家数，0/容量无信息量）。
       MOTD 用与地址胶囊同套背景块承载（同圆角/同--ss-row-h 行高），
       与上方标签行、下方说明文字拉开层次，但不是一行裸文本。 */
    if (res.status === 'online' || res.status === 'sleeping') {
      if (res.data.motdHtml || res.data.motdClean) {
        var motdBlock = document.createElement('div');
        motdBlock.className = 'server-status__motd-block';
        var motd = document.createElement('div');
        motd.className = 'server-status__motd';
        if (res.data.motdHtml) motd.innerHTML = sanitizeMotdHtml(res.data.motdHtml);
        else motd.textContent = res.data.motdClean;
        motdBlock.appendChild(motd);
        card.appendChild(motdBlock);
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

    /* ── 用户操作区：地址胶囊 → 「在浏览器中玩」→ 社区链接 ── */
    var actions = document.createElement('div');
    actions.className = 'server-status__actions';

    /* 地址胶囊：仅当 show_address=true（server.show）时显示；false 则地址彻底隐藏，
       不渲染任何胶囊（无掩码/复制/眼睛）。胶囊默认掩码 + 眼睛切换 + 复制按钮，
       明文只在用户点开眼睛时解码（防爬虫观感）。Java 版必显（若显示），基岩版仅在
       配置了 bedrock（host 或 port）时显示，Web 版（浏览器 / Eaglercraft）仅在配置了
       web（host 或 port）时显示。三版地址默认都带端口号（Java 25565 / 基岩 19132 /
       Web 443 省略）——连接需知端口，且整行展示不截断。 */
    if (server.show) {
      /* 地址明/密文状态存 addrReveals（按 server.key）：刷新后按此恢复，不重置回掩码 */
      var addrState = addrReveals.get(server.key) || {};
      var javaAddress = server.host + ':' + server.port;
      /* 有第二/第三种客户端时才把 Java 版地址显式标注类型（否则「服务器地址」更泛用） */
      var multiClient = !!(server.bedrockHost || server.webAddress);
      actions.appendChild(buildAddrPill(
        multiClient ? 'Java版客户端连接地址' : '服务器地址', javaAddress, !!addrState.java,
        function (r) {
          var st = addrReveals.get(server.key) || {};
          st.java = r;
          addrReveals.set(server.key, st);
        },
        multiClient ? 'java' : 'generic'
      ));

      if (server.bedrockHost) {
        actions.appendChild(buildAddrPill(
          '基岩版客户端连接地址', server.bedrockHost + ':' + server.bedrockPort, !!addrState.bedrock,
          function (r) {
            var st = addrReveals.get(server.key) || {};
            st.bedrock = r;
            addrReveals.set(server.key, st);
          },
          'bedrock'
        ));
      }

      /* Web 客户端（浏览器 / Eaglercraft）：wss://<host>:<port> —— 浏览器客户端只接受
         TLS 直连地址；与 Java/基岩一致不带结尾斜杠（整串可直接复制粘贴进 Web 客户端）。 */
      if (server.webAddress) {
        actions.appendChild(buildAddrPill(
          'Web客户端连接地址', server.webAddress, !!addrState.web,
          function (r) {
            var st = addrReveals.get(server.key) || {};
            st.web = r;
            addrReveals.set(server.key, st);
          },
          'web'
        ));
      }
    }

    /* 「在浏览器中玩」：紧跟 Web 地址胶囊（关联性最强）；地址隐藏（show=false）时
       没有胶囊，它就落在操作区第一行，仍是卡片里唯一「直接进游戏」的动作。
       只要该服支持 Eaglercraft（配了 web 地址）就显示——不看 show_address，
       因为这是「能不能用浏览器玩」的能力开关；没适配的服不会出现这个入口。
       点击 = 复制本服 wss:// 地址 + 新标签打开官方 Web 客户端（版本由 web_client_url 决定），
       用户到客户端「多人游戏 → 直连」粘贴即可。不自托管客户端：75 MiB 单文件既不适合放
       GitHub Pages（仓库/带宽），也不该打自家家宽上行。 */
    if (server.webAddress && webClientUrl) {
      actions.appendChild(buildPlayBlock(server.webAddress, server.webVersion));
    }

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

  /* ── Tab 切换（多服务器共用一块展示区域）──
     仅当配置 tabs=true 且服务器数 > 1 时启用：上方一排 Tab（名称 + 状态色点），
     下方网格同一时间只显示选中的那张卡（其余靠 .is-tab-hidden 隐藏，节点保留，
     切回时无需重建、玩家面板与地址明/密文状态都还在）。
     Tab 的状态点随每次刷新同步（在线绿 / 休眠黄 / 离线红 / 查询中灰），
     未激活的服务器也能一眼看出在线与否。键盘：←/→/Home/End 切换。 */
  function buildTabs() {
    tabsEl = document.createElement('div');
    tabsEl.className = 'server-status__tabs';
    tabsEl.setAttribute('role', 'tablist');
    tabsEl.setAttribute('aria-label', '选择服务器');
    servers.forEach(function (server, idx) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'server-status__tab';
      tab.id = 'server-status-tab-' + server.key;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'server-status-panel-' + server.key);
      tab.setAttribute('aria-selected', 'false');
      tab.tabIndex = -1;
      var dot = document.createElement('span');
      dot.className = 'server-status__tab-dot';
      dot.setAttribute('aria-hidden', 'true');
      tab.appendChild(dot);
      tab.appendChild(document.createTextNode(server.name));
      tab.addEventListener('click', function () { selectTab(server.key); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = servers[(idx + 1) % servers.length];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = servers[(idx - 1 + servers.length) % servers.length];
        else if (e.key === 'Home') next = servers[0];
        else if (e.key === 'End') next = servers[servers.length - 1];
        if (!next) return;
        e.preventDefault();
        selectTab(next.key, true);
      });
      tabsEl.appendChild(tab);
    });
    section.insertBefore(tabsEl, grid);
  }

  function selectTab(key, focus) {
    activeKey = key;
    syncTabs();
    if (focus) {
      var tab = document.getElementById('server-status-tab-' + key);
      if (tab) tab.focus();
    }
  }

  function syncTabs() {
    if (!tabsEnabled) return;
    servers.forEach(function (server) {
      var active = server.key === activeKey;
      var tab = document.getElementById('server-status-tab-' + server.key);
      if (tab) {
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
        var res = results.get(server.key);
        tab.dataset.status = res ? res.status : 'loading';
      }
      var card = findCard(server.key);
      if (card) card.classList.toggle('is-tab-hidden', !active);
    });
  }

  function findCard(key) {
    for (var i = 0; i < grid.children.length; i++) {
      if (grid.children[i].dataset.serverKey === key) return grid.children[i];
    }
    return null;
  }

  function renderCardInPlace(server) {
    var old = findCard(server.key);
    /* 保留展开的玩家面板：先摘下（避免被下方清空销毁），换完内容后再挂回，
       头像不重载、面板不闪关。 */
    var preservedPanel = null;
    var openPanel = openPanels.get(server.key);
    if (old && openPanel && openPanel.parentNode === old) {
      old.removeChild(openPanel);
      preservedPanel = openPanel;
    }
    var card = renderCard(server);
    if (!old) {
      grid.appendChild(card);
      syncTabs();   // 新卡插入后同步 Tab 可见性（否则 Tab 默认全部展开）
      return;
    }
    /* 原地更新：保留卡片节点，只换状态类与内容。
       若用 replaceWith 整卡换新，:hover 会在换卡瞬间重算（新节点先按未悬停
       translateY:0 渲染），再触发 transform transition 滑回 -2px，造成一次
       "落下又抬起"的渲染抖动。保留节点则 hover 状态不重置、过渡不触发。 */
    old.className = card.className;
    while (old.firstChild) old.removeChild(old.firstChild);
    while (card.firstChild) old.appendChild(card.firstChild);
    /* 恢复玩家面板：新卡仍有可展开按钮时才恢复（新数据可能已无玩家列表 / 不在线） */
    if (preservedPanel) {
      var newMeta = old.querySelector('.server-status__meta-line');
      var newToggle = old.querySelector('.server-status__players-toggle');
      if (newMeta && newToggle) {
        old.insertBefore(preservedPanel, newMeta.nextSibling);
        newToggle.setAttribute('aria-expanded', 'true');
      } else {
        openPanels.delete(server.key);   // 新数据不再有玩家列表，放弃恢复
      }
    }
    syncTabs();   // 重渲染会把 className 重置掉，这里补回 Tab 选中态与隐藏类
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

    /* 地址解码表由模板随配置下发（cipher_plain / cipher_mapping），置于
       servers 映射（decodeHost 调用点）之前 */
    PLAIN_TABLE = cfg.cipher_plain || '';
    CIPHER_TABLE = cfg.cipher_mapping || '';

    /* refresh_interval=0 表示关闭自动刷新（仅手动） */
    refreshInterval = (cfg.refresh_interval > 0) ? cfg.refresh_interval : 0;
    api = String(cfg.api || 'https://api.mcstatus.io/v2/status/java').replace(/\/+$/, '');
    webClientUrl = String(cfg.web_client_url || '');
    servers = (cfg.servers || []).map(function (s, i) {
      var host = decodeHost(s.host || '');
      var port = s.port || 25565;
      /* 基岩版地址：可选。与 Java 版互通、同主机不同端口。
         仅配置了 bedrock_host 或 bedrock_port 才渲染「基岩版」胶囊；
         host 缺省时沿用 Java 地址（同主机），端口缺省 19132（Geyser）。 */
      var hasBedrock = s.bedrock_host || s.bedrock_port;
      var bedrockHost = hasBedrock ? decodeHost(s.bedrock_host || host) : '';
      /* Web 客户端（浏览器 / Eaglercraft）地址：可选。只接受 TLS(wss) 直连，
         形如 wss://<host>:<port>/；host 缺省沿用 Java 地址（可与服务器不同，如独立子域），
         端口缺省 443（443 不可用时站点走 18443）。与 Java/基岩一致，端口一律显式展示
         （不按 URL 惯例省略 443），三枚胶囊观感统一。
         容错：web_host 误写成完整地址（带 wss:// 或结尾斜杠）也能用。 */
      var hasWeb = s.web_host || s.web_port;
      var webHost = hasWeb
        ? decodeHost(s.web_host || host).replace(/^wss?:\/\//i, '').replace(/\/+$/, '')
        : '';
      var webPort = hasWeb ? (s.web_port || 443) : 0;
      return {
        /* 内部索引用作 key：不把明文地址写进 DOM（data-server-key） */
        key: String(i),
        name: s.name || host,
        host: host,
        port: port,
        bedrockHost: bedrockHost,
        bedrockPort: hasBedrock ? (s.bedrock_port || 19132) : 0,
        webAddress: hasWeb ? ('wss://' + webHost + ':' + webPort) : '',
        webVersion: s.web_version || '',
        note: s.note || '',
        links: s.links || [],
        /* 自动刷新间隔（秒）：per-server refresh_interval 优先，否则回退全局；0/负 = 仅手动 */
        refresh: (typeof s.refresh_interval === 'number') ? s.refresh_interval : refreshInterval,
        show: (typeof s.show_address === 'boolean') ? s.show_address : !!cfg.show_address
      };
    });
    if (!servers.length) return;

    /* Tab 模式：多服务器共用一块展示区域（配置 tabs=true），默认选中第一台 */
    tabsEnabled = !!cfg.tabs && servers.length > 1;
    if (tabsEnabled) {
      activeKey = servers[0].key;
      buildTabs();
    }

    renderAll();          // 先显示“查询中”占位，逐台异步更新
    loadAll();
    /* 自动刷新按每台服务器各自间隔调度：per-server refresh_interval 优先，
       否则回退全局 refresh_interval；<=0 表示该服不自动刷新（仅手动）。
       并发请求由 inflight 去重，与徽标点击的手动刷新共享同一去重。 */
    servers.forEach(function (server) {
      if (server.refresh > 0) {
        setInterval(function () {
          loadServer(server).then(function () { renderCardInPlace(server); });
        }, server.refresh * 1000);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
