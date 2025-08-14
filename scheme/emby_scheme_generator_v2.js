function parseEmbyInfo(configText) {
  const embyInfo = { username: '', password: '', lines: [] };
  const textLines = configText.split('\n');
  let lastHost = null;

  const regexPatterns = {
    username: /(?:用户名|用户名称)\s*[|：:]\s*(\S.+)/u,
    password: /(?:密码|用户密码)\s*[|：:]\s*(\S+)/,
    genericUrl: /((?:[\w\d\u4e00-\u9fa5]*\s*线路\s*\d*|服务器|地址|主机名|备用|ip|cf)\s*)[|：:]\s*((https?:\/\/)?[a-zA-Z0-9.\-]+\.[a-zA-Z0-9.\-:]*)/i,
    standaloneUrl: /^((https?:\/\/)?[a-zA-Z0-9.\-]+\.[a-zA-Z0-9.\-:]*)/,
    port: /(?:https?\s*端口|端口)\s*[|：:]\s*(\d{2,5})/,
  };

  function processUrlMatch(lineInfo) {
    const { title, url: fullUrl } = lineInfo;
    const hasPort = fullUrl.startsWith('http') ?
      !!new URL(fullUrl).port :
      !!fullUrl.match(/^(.*):(\d+)$/);

    if (hasPort) {
      embyInfo.lines.push({ title, url: fullUrl });
      lastHost = null;
    } else {
      lastHost = { title, host: fullUrl };
    }
  }

  for (const line of textLines) {
    // console.log(line);
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const isLabelLine = trimmedLine.match(regexPatterns.genericUrl) ||
        trimmedLine.match(regexPatterns.username) ||
        trimmedLine.match(regexPatterns.password);

    if (lastHost && isLabelLine) {
        const portMatch = trimmedLine.match(regexPatterns.port);
        if (portMatch && lastHost) {
          const port = portMatch[1];
          const url = `${lastHost.host}:${port}`;
          embyInfo.lines.push({ title: lastHost.title, url });
          lastHost = null;
          continue;
        }

        embyInfo.lines.push({ title: lastHost.title, url: lastHost.host });
        lastHost = null;
    }

    let usernameMatch = trimmedLine.match(regexPatterns.username);
    if (usernameMatch && !embyInfo.username) embyInfo.username = usernameMatch[1];

    let passwordMatch = trimmedLine.match(regexPatterns.password);
    if (passwordMatch && !embyInfo.password) embyInfo.password = passwordMatch[1];

    let genericUrlMatch = trimmedLine.match(regexPatterns.genericUrl);
    if (genericUrlMatch) {
      const label = genericUrlMatch[1].trim();
      const fullUrl = genericUrlMatch[2];
      processUrlMatch({ title: label, url: fullUrl });
      continue;
    }

    let standaloneUrlMatch = trimmedLine.match(regexPatterns.standaloneUrl);
    if (standaloneUrlMatch) {
      const label = '线路';
      const fullUrl = standaloneUrlMatch[1];
      processUrlMatch({ title: label, url: fullUrl });
      continue;
    }

    let portMatch  = trimmedLine.match(regexPatterns.port);
    if (portMatch && lastHost) {
      const port = portMatch[1];
      const url = `${lastHost.host}:${port}`;
      embyInfo.lines.push({ title: lastHost.title, url });
      lastHost = null;
      continue;
    }
  }

  if (lastHost) {
      embyInfo.lines.push({ title: lastHost.title, url: lastHost.host });
  }

  // URL normalization
  embyInfo.lines = embyInfo.lines.map(line => {
    if (!line.url) return line;
    let url = line.url.trim();
    
    try {
      if ((url.startsWith('http://') || url.startsWith('https://')) && 
          (new URL(url).port || url.match(/:(\d+)(?:[^\d]|$)/))) {
        return line;
      }

      if (!url.startsWith('http')) {
        const portMatch = url.match(/:(\d+)(?:[^\d]|$)/);
        if (portMatch) {
          const port = portMatch[1];
          const protocol = (port === '443' || port === '8443') ? 'https://' : 'http://';
          url = `${protocol}${url}`;
        } else {
          url = `https://${url}:443`;
        }
      }
      
      if (!new URL(url).port && !url.match(/:(\d+)$/)) {
        const defaultPort = url.startsWith('https://') ? ':443' : ':80';
        url = `${url}${defaultPort}`;
      }
    } catch (e) {
      console.log(`URL处理错误: ${url}`, e);
    }
    
    return { ...line, url };
  });

  // filter URL，eg: http(s)://host(:port)?
  const blacklistPattern = /\b(wiki|faka|notion|t\.me|telegram|help)\b/i;
  const simpleUrlPattern = /^(https?:\/\/)([a-zA-Z0-9\-\.]+)+(:\d{1,5})?$/i;

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


const genericConfig = `

用户名：user张三-abc_123🚀
密码：mypassword456

# 带标签的可能情况
当前线路：https://emby-1.example.com:443
主线路：https://emby-2.example.com
端口：8096

服务器：https://emby-3.example.com/
地址|https://emby-4.example.com:9000/

IP线路: https://192.168.1.10:8920
IP线路2: https://192.168.1.11:8443
端口:8443
域名线路|https://emby-5.example.com:443/

国内直连线路：https://cn-1.example.com
海外线路：https://overseas-1.example.com:8096
CDN加速线路：https://cdn-hk.example.com:443
联通线路|https://unicom-1.example.com
端口:443

# 主机名+端口的组合格式
服务器：emby-6.example.com
端口：8096
主机名：emby-7.example.com
https 端口：443

IP地址：192.168.1.20
http端口: 8920
直连地址：direct-1.example.com:9000
移动线路：mobile-1.example.com:8088（备注）
电信线路：telecom-1.example.com
端口|9001

cf线路：cf-1.example.com

# standardURL no label
https://standalone-1.example.com
https 端口：443
https://standalone-2.example.com:8096/(备注)
https://192.168.1.30:8443
standalone-3.example.com:9999
standalone-4.example.com
端口：443（备注）
192.168.1.40:80
192.168.1.50
端口：8088

推荐地址：https://wiki.emby.com
续费地址：https://faka.example.com
说明文档：https://notion.example.com/help
Telegram：https://t.me/embychannel
帮助页面：https://help.emby.com

`;


const debugConfig = `

# standardURL no label
https://standaline1.emby.com
https 端口：443
https://standaline2.emby.com:8096/(备注)
https://192.168.1.101:8443
standaline3.emby.com:9999
standaline4.example.com
端口：443（备注）
192.168.1.201:80
192.168.1.303
端口：8088

`;

const genericInfo = parseEmbyInfo(genericConfig);
console.log(genericInfo)

// const debugInfo = parseEmbyInfo(debugConfig);
// console.log(debugInfo)
