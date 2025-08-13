function parseEmbyInfo(configText) {
  const embyInfo = { username: '', password: '', lines: [] };
  const textLines = configText.split('\n');
  let lastHost = null;

  const regexPatterns = {
    username: /(?:用户名|用户名称)\s*[|：:]\s*([\p{L}\p{N}_\-\u{1F300}-\u{1FAFF}]+)/u,
    password: /(?:密码|用户密码)\s*[|：:]\s*(\S+)/,
    // genericUrl: /((?:当前线路|主线路|服务器|地址|主机名|ip|直连|[\w\d\u4e00-\u9fa5]*线路)\s*)[|：:]\s*(https?:\/\/[a-zA-Z0-9.\-:]+)/,
    genericUrl: /((?:当前线路|主线路|服务器|地址|主机名|ip|[^\s|：:]*线路)\s*)[|：:]\s*((?:https?:\/\/)?[a-zA-Z0-9.\-:\[\]]+)(?::(\d{1,5}))?\/$/,
    // hostLineUrl: /((?:当前线路|主线路|服务器|地址|主机名|ip|[\w\d\u4e00-\u9fa5]*线路)\s*)[|：:]\s*(\S+)/,
    // standaloneUrl: /^(https?:\/\/)?((\d{1,3}\.){3}\d{1,3}|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(:\d{1,5})?$/,
    // standaloneUrl: /^(https?:\/\/[a-zA-Z0-9.\-:]+\/?)$/,
    standaloneUrl: /^(https?:\/\/)?([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*|\d{1,3}(\.\d{1,3}){3}|\[[a-fA-F0-9:]+\])(:\d{1,5})?\/?$/,
    port: /(?:https?\s*端口|端口)\s*[|：:]\s*(\d{2,5})/,
  };

  for (const line of textLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    // 用户名
    let match = trimmedLine.match(regexPatterns.username);
    if (match && !embyInfo.username) embyInfo.username = match[1];
    // 密码
    match = trimmedLine.match(regexPatterns.password);
    if (match && !embyInfo.password) embyInfo.password = match[1];

    // URL / Host 统一处理
    match = trimmedLine.match(regexPatterns.genericUrl);
    if (match) {
        const title = match[1].trim();
        const hostOrUrl = match[2];
        const portPart = match[3];
        let url = '';

        if (portPart) {
            if (hostOrUrl.startsWith('http')) {
                url = hostOrUrl + `:${portPart}`;
            } else {
                // 没有协议，根据端口补充 http 或 https
                const scheme = portPart === '443' ? 'https://' : 'http://';
                url = scheme + hostOrUrl + `:${portPart}`;
            }
            embyInfo.lines.push({ title, url });
            lastHost = null;
        } else {
            // 同一行没有端口，缓存 host/URL，等待下一行端口
            lastHost = { title, host: hostOrUrl };
            // 如果 host 已经带协议，可以先 push 不带端口的 URL（可选）
            // embyInfo.lines.push({ title, url: hostOrUrl });
        }
        continue;
    }

    // standalone URL / IP
    match = trimmedLine.match(regexPatterns.standaloneUrl);
    if (match) {
      // 组合完整 URL (协议可选 + IP/域名 + 可选端口)
      const protocol = match[1] || '';
      const hostOrIp = match[2];
      const portPart = match[5];
      let url = '';

      if (portPart) {
         if (protocol) {
            url = protocol + hostOrIp + `:${portPart}`;
         } else {
            // 没有协议，根据端口补充 http 或 https
            const scheme = portPart === '443' ? 'https://' : 'http://';
            url = scheme + hostOrIp + `:${portPart}`;
         }
         embyInfo.lines.push({ title: '线路', url });
         lastHost = null;
      } else {
        // 没有端口 → 缓存等待下一行端口
        lastHost = { title: '线路', host: protocol + hostOrIp };
      }
      continue;
    }

    // 端口单独行
    match = trimmedLine.match(regexPatterns.port);
    if (match && lastHost) {
      const port = match[1];
      const scheme = (port === '443') ? 'https' : 'http';
      const url = `${scheme}://${lastHost.host}:${port}`;
      embyInfo.lines.push({ title: lastHost.title, url });
      lastHost = null;
      continue;
    }

    // 循环结束后处理未完成的 lastHost
    if (lastHost) {
        const host = lastHost.host;
        const title = lastHost.title;
        let url;

        if (host.startsWith('https://')) {
            url = host + ':443';
        } else if (host.startsWith('http://')) {
            url = host + ':80';
        } else {
            url = host;
        }

        embyInfo.lines.push({ title, url });
        lastHost = null;
    }
  }

  // 过滤格式不符合的 URL，简单校验 http(s)://host(:port)?
  const blacklistPattern = /wiki|faka|notion|t\.me|推荐|续费/i;
  const simpleUrlPattern = /^(https?:\/\/)?((\d{1,3}\.){3}\d{1,3}|\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(:\d{1,5})?\/?$/i;

  embyInfo.lines = embyInfo.lines.filter(line => {
    if (!line.url) return false;
    const urlStr = line.url.trim();

    if (blacklistPattern.test(urlStr)) {
        console.log(`黑名单过滤: ${line.url}`);
        return false;
    }
    if (!simpleUrlPattern.test(urlStr)) {
        console.log(`格式不符，跳过: ${line.url}`);
        return false;
    }
    return true;
  });

  return embyInfo;
}


function parseEmbyInfoGemini(configText) {
  const embyInfo = { username: '', password: '', lines: [] };
  const textLines = configText.split('\n');
  let parserState = {};

  const matchers = [
    {
      name: 'credentials',
      regex: /(?:(用户名|用户名称)\s*[|：:]\s*([a-zA-Z0-9\-_]+))|(?:(密码|用户密码)\s*[|：:]\s*(\S+))/,
      process: (match, info, state) => {
        if (match[1] && !info.username) info.username = match[2];
        if (match[3] && !info.password) info.password = match[4];
        state.pendingHost = null;
      }
    },
    {
      name: 'labeledLine',
      // 优化点：将原先贪婪的 ._ 替换为 \S_，确保只匹配URL本身，不会捕获后面的注释或无关字符。
      regex: /((?:当前线路|服务器|地址|主机名|ip[\w\d\u4e00-\u9fa5]*|域名[\w\d\u4e00-\u9fa5]*|直连[\w\d\u4e00-\u9fa5]*|[\w\d\u4e00-\u9fa5]*线路)\s*)[|：:]\s*((https?:\/\/)?(\S+))/,
      process: (match, info, state) => {
        const title = match[1].trim().replace('当前线路', '线路');
        const fullUrlText = match[2]; // 包含协议的完整文本
        const hasProtocol = fullUrlText.startsWith('http');

        if (hasProtocol) {
          info.lines.push({ title, url: fullUrlText });
          state.pendingHost = null;
        } else {
          state.pendingHost = { title, host: fullUrlText };
        }
      }
    },
    {
      name: 'portLine',
      regex: /(?:https? 端口|端口)\s*[|：:]\s*(\d{2,5})/,
      process: (match, info, state) => {
        if (state.pendingHost) {
          const port = match[1];
          const scheme = (port === '80') ? 'http' : 'https';
          const url = `${scheme}://${state.pendingHost.host}:${port}`;
          info.lines.push({ title: state.pendingHost.title, url });
        }
        state.pendingHost = null;
      }
    },
    {
      name: 'standaloneUrl',
      regex: /^(https?:\/\/[a-zA-Z0-9.\-:]+(\/\S*)?)$/,
      process: (match, info, state) => {
        info.lines.push({ title: '线路', url: match[1] });
        state.pendingHost = null;
      }
    }
  ];

  for (const line of textLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let isMatched = false;
    for (const matcher of matchers) {
      const match = trimmedLine.match(matcher.regex);
      if (match) {
        matcher.process(match, embyInfo, parserState);
        isMatched = true;
        break;
      }
    }

    if (!isMatched) {
        parserState.pendingHost = null;
    }
  }

  const finalUrlPattern = /^https?:\/\/[\w.-]+(:\d+)?(\/.*)?$/i;
  embyInfo.lines = embyInfo.lines.filter(line => {
    if (!line.url || !finalUrlPattern.test(line.url.trim())) {
      console.log(`格式不符或解析不完整，已跳过: ${line.url}`);
      return false;
    }
    // 过滤掉可能因为 \S+ 匹配错误的，包含括号的 url
    if (/[()\[\]]/.test(line.url)) {
      console.log(`URL包含无效字符，已跳过: ${line.url}`);
      return false;
    }
    return true;
  });

  return embyInfo;
}

function parseEmbyInfoClaude(configText) {
  // 初始化返回对象
  const embyInfo = {
    username: '',
    password: '',
    lines: []
  };

  // 输入验证
  if (!configText || typeof configText !== 'string') {
    return embyInfo;
  }

  const textLines = configText.split('\n');
  let pendingHost = null;

  // 优化后的正则表达式模式
  const patterns = {
    username: /(?:用户名|用户名称)\s*[|：:]\s*([a-zA-Z0-9\-_]+)/i,
    password: /(?:密码|用户密码)\s*[|：:]\s*(\S+)/i,
    completeUrl: /((?:当前线路|主线路|服务器|地址|主机名|ip[\w\d\u4e00-\u9fa5]*|域名[\w\d\u4e00-\u9fa5]*|直连[\w\d\u4e00-\u9fa5]*|[\w\d\u4e00-\u9fa5]*线路)\s*)[|：:]\s*(https?:\/\/[^\s]+)/i,
    hostOnly: /((?:当前线路|主线路|服务器|地址|主机名|ip[\w\d\u4e00-\u9fa5]*|域名[\w\d\u4e00-\u9fa5]*|直连[\w\d\u4e00-\u9fa5]*|[\w\d\u4e00-\u9fa5]*线路)\s*)[|：:]\s*([^\s]+)/i,
    standaloneUrl: /^(https?:\/\/[^\s]+\/?)$/i,
    port: /(?:https?\s*端口|端口)\s*[|：:]\s*(\d{2,5})/i,
  };

  // 用于过滤无效URL的关键词
  const excludeKeywords = /wiki|faka|notion|t\.me|推荐|续费|帮助|说明/i;

  // 验证URL格式的函数
  const isValidUrl = (url) => {
    if (!url || typeof url !== 'string') return false;

    const cleanUrl = url.trim();
    // 更严格的URL验证
    const urlPattern = /^https?:\/\/[\w\-.]+(:\d{1,5})?(\/[^\s]*)?$/i;

    if (!urlPattern.test(cleanUrl)) {
      console.log(`URL格式不符，跳过: ${cleanUrl}`);
      return false;
    }

    // 检查是否包含排除关键词
    if (excludeKeywords.test(cleanUrl)) {
      console.log(`包含排除关键词，跳过: ${cleanUrl}`);
      return false;
    }

    return true;
  };

  // 添加线路的辅助函数
  const addLine = (title, url) => {
    if (isValidUrl(url)) {
      const cleanTitle = title.trim().replace(/^当前/, '');
      embyInfo.lines.push({
        title: cleanTitle || '线路',
        url: url.trim()
      });
    }
  };

  // 解析每一行
  for (const line of textLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 尝试匹配用户名（只匹配第一个）
    if (!embyInfo.username) {
      const usernameMatch = trimmedLine.match(patterns.username);
      if (usernameMatch) {
        embyInfo.username = usernameMatch[1].trim();
        continue;
      }
    }

    // 尝试匹配密码（只匹配第一个）
    if (!embyInfo.password) {
      const passwordMatch = trimmedLine.match(patterns.password);
      if (passwordMatch) {
        embyInfo.password = passwordMatch[1].trim();
        continue;
      }
    }

    // 匹配完整的URL（带标签）
    const completeUrlMatch = trimmedLine.match(patterns.completeUrl);
    if (completeUrlMatch) {
      addLine(completeUrlMatch[1], completeUrlMatch[2]);
      pendingHost = null;
      continue;
    }

    // 匹配主机名或URL（带标签）
    const hostMatch = trimmedLine.match(patterns.hostOnly);
    if (hostMatch) {
      const title = hostMatch[1].trim();
      const hostOrUrl = hostMatch[2].trim();

      if (hostOrUrl.startsWith('http')) {
        // 这是一个完整的URL
        addLine(title, hostOrUrl);
        pendingHost = null;
      } else {
        // 这是一个主机名，等待端口信息
        pendingHost = { title, host: hostOrUrl };
      }
      continue;
    }

    // 匹配端口信息
    const portMatch = trimmedLine.match(patterns.port);
    if (portMatch && pendingHost) {
      const port = parseInt(portMatch[1]);
      const scheme = (port === 443) ? 'https' : 'http';
      const url = `${scheme}://${pendingHost.host}:${port}`;
      addLine(pendingHost.title, url);
      pendingHost = null;
      continue;
    }

    // 匹配独立的URL
    const standaloneUrlMatch = trimmedLine.match(patterns.standaloneUrl);
    if (standaloneUrlMatch) {
      addLine('线路', standaloneUrlMatch[1]);
      continue;
    }
  }

  // 去重处理（基于URL）
  const uniqueLines = [];
  const seenUrls = new Set();

  for (const line of embyInfo.lines) {
    if (!seenUrls.has(line.url)) {
      seenUrls.add(line.url);
      uniqueLines.push(line);
    }
  }

  embyInfo.lines = uniqueLines;

  return embyInfo;
}

// genericUrl 端口捕获组索引错 → portPart 可能永远是 undefined
// 循环结束 lastHost 处理可能导致重复端口或被过滤
// 最后过滤的 simpleUrlPattern 太严格 → IPv6、无协议或带端口 URL 被误删


// 模拟的 Emby 配置文本
const sampleConfig = `
用户名：user张三-abc_123🚀
密码：mypassword456

# 各种完整URL格式
当前线路：https://emby-1.example.com
主线路：https://emby-02.example.com:
端口：8096
服务器：https://emby3.example.com/
地址|https://emby4.example.com:9000/
IP线路: https://192.168.1.100:8920
域名线路|https://cdn.emby.com:443/

# 主机名+端口的组合格式
服务器：emby5.example.com
端口：8096
主机名：emby6.example.com
https 端口：443
IP地址：192.168.1.200
端口: 8920
直连地址：local.emby.com
端口：9000

换行url线路：
embyurl.example.com:1020

# 独立URL（无标签）
https://standalone1.emby.com
https://standalone2.emby.com:8096/（备注）
http://standalone3.emby.com:9999(备注)

# 需要被过滤的无效内容
推荐地址：https://wiki.emby.com
续费地址：https://faka.example.com
说明文档：https://notion.example.com/help
Telegram：https://t.me/embychannel
帮助页面：https://help.emby.com

# 格式不正确的URL
无效格式1：not-a-valid-url
无效格式2：ftp://invalid.protocol.com
无效格式3：https://
无效格式4：http://invalid space.com

# 重复的URL（测试去重）
重复线路1：https://emby1.example.com
重复线路2：https://emby2.example.com:8096
备用重复：https://emby1.example.com/

# 边界情况
空行和空格混合


# 特殊字符和中文标签
国内直连线路：https://cn.emby.com
海外线路：https://overseas.emby.com:8096
CDN加速线路：https://cdn-hk.emby.com:443
移动线路：mobile.emby.com
端口：8088

# 混合分隔符
联通线路|https://unicom.emby.com
电信线路：telecom.emby.com
端口|9001
`;

// 调用解析函数
const embyInfo = parseEmbyInfo(sampleConfig);
// const embyInfoG = parseEmbyInfoGemini(sampleConfig);
// const embyInfoC = parseEmbyInfoClaude(sampleConfig);

console.log(embyInfo)
// console.log(embyInfoG)
// console.log(embyInfoC)
