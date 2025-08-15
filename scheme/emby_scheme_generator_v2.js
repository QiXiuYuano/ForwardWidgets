function parseUrl(urlString) {
    if (!urlString || typeof urlString !== 'string') {
        return null;
    }

    try {
        if (typeof URL !== 'undefined') {
            try {
                const urlObj = new URL(urlString);
                return {
                    protocol: urlObj.protocol || '',
                    hostname: urlObj.hostname || '',
                    port: urlObj.port || '',
                    pathname: urlObj.pathname || '/',
                    search: urlObj.search || '',
                    hash: urlObj.hash || '',
                    toString: () => urlString
                };
            } catch (e) {
                // 继续使用手动解析
            }
        }
        
        // 手动解析 URL（用于 Scriptable 或 URL 解析失败的情况）
        const urlPattern = /^(https?:)\/\/([^\/:]+)(?::(\d+))?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/;
        const match = urlString.match(urlPattern);
        
        if (!match) {
            return null;
        }
        
        const [, protocol = '', hostname = '', port = '', pathname = '/', search = '', hash = ''] = match;
        
        return {
            protocol,
            hostname,
            port,
            pathname,
            search,
            hash,
            toString: () => urlString
        };
    } catch (e) {
        // console.error('URL parsing error:', e);
        return null;
    }
}


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
        const parsedUrl = parseUrl(fullUrl);
        const hasPort = fullUrl.startsWith('http') ?
            !!(parsedUrl && parsedUrl.port) :
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

        let portMatch = trimmedLine.match(regexPatterns.port);
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
            const parsedUrl1 = parseUrl(url);
            if ((url.startsWith('http://') || url.startsWith('https://')) &&
                (parsedUrl1 && parsedUrl1.port || url.match(/:(\d+)(?:[^\d]|$)/))) {
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

            const parsedUrl2 = parseUrl(url);
            if (parsedUrl2 && !parsedUrl2.port && !url.match(/:(\d+)$/)) {
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


function processEmbyLines(lines) {
    if (!lines || lines.length === 0) return null;

    const mainLine = lines[0];
    const mainUrl = parseUrl(mainLine.url.trim());
    const mainInfo = {
        scheme: mainUrl.protocol.replace(':', ''),
        host: mainUrl.hostname,
        port: mainUrl.port || (mainUrl.protocol === 'https:' ? '443' : '80'),
        path: mainUrl.pathname + mainUrl.search + mainUrl.hash,
        title: '主线路',
        url: mainLine.url
    };

    let genericLineCounter = 1;
    const backupLines = lines.slice(1).map((line, index) => {
        const lineUrl = parseUrl(line.url.trim());
        let lineTitle = line.title;

        if (lineTitle === '线路') {
            lineTitle = `备用线路${genericLineCounter}`;
            genericLineCounter++;
        }

        return {
            index: index + 1,
            scheme: lineUrl.protocol.replace(':', ''),
            host: lineUrl.hostname,
            port: lineUrl.port || (lineUrl.protocol === 'https:' ? '443' : '80'),
            path: lineUrl.pathname + lineUrl.search + lineUrl.hash,
            title: lineTitle,
            url: line.url,
            originalTitle: line.title
        };
    });

    return {
        main: mainInfo,
        backup: backupLines
    };
}

function generateForwardSchemeUrl(embyInfo) {
    const processedLines = processEmbyLines(embyInfo.lines);
    if (!processedLines) return null;

    const { main, backup } = processedLines;

    let url = `forward://import?type=emby&scheme=${main.scheme}&host=${main.host}&port=${main.port}&title=${main.title}&username=${embyInfo.username}&password=${embyInfo.password}`;

    backup.forEach(line => {
        const normalizedUrl = line.url.endsWith('/') ? line.url.slice(0, -1) : line.url;
        url += `&line${line.index}=${normalizedUrl}&line${line.index}title=${line.title}`;
    });

    return url;
}

function generateSenPlayerSchemeUrl(embyInfo) {
    const processedLines = processEmbyLines(embyInfo.lines);
    if (!processedLines) return null;

    const { main, backup } = processedLines;

    let address = `${main.scheme}://${main.host}`;
    if (main.port) {
        address += `:${main.port}`;
    }
    address += main.path;

    let url = `senplayer://importserver?type=emby&address=${address}&username=${embyInfo.username}&password=${embyInfo.password}`;

    backup.forEach(line => {
        let lineAddress = `${line.scheme}://${line.host}`;
        if (line.port) {
            lineAddress += `:${line.port}`;
        }
        lineAddress += line.path;

        url += `&address${line.index}=${lineAddress}&address${line.index}name=${line.title}`;
    });

    return url;
}

async function run(configText) {
    const embyInfo = parseEmbyInfo(configText);
    return {
        Forward: generateForwardSchemeUrl(embyInfo),
        SenPlayer: generateSenPlayerSchemeUrl(embyInfo)
    };
}

module.exports = { parseEmbyInfo, generateForwardSchemeUrl, generateSenPlayerSchemeUrl, run };
