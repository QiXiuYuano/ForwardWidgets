/**
 * Scriptable Emby 脚本本地测试 - 纯JavaScript版本
 * 从HTML版本提取并适配为可直接在Node.js环境中运行
 */

// 模拟控制台输出
const console = {
    log: (...args) => {
        const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        print(`[LOG] ${message}`);
    },
    error: (...args) => {
        const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        print(`[ERROR] ${message}`);
    },
    warn: (...args) => {
        const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        print(`[WARN] ${message}`);
    }
};

// 模拟 Pasteboard
const Pasteboard = {
    pasteString: () => {
        console.log("模拟: Pasteboard.pasteString() 被调用");
        // 在实际使用中，这里应该从剪贴板获取内容
        // 由于是命令行环境，我们返回一个示例文本
        return getClipboardText();
    },
    copyString: (str) => {
        console.log("模拟: Pasteboard.copyString() 被调用");
        console.log("生成的URL: " + str);
        // 在实际使用中，这里应该复制到剪贴板
        // 在命令行环境中，我们直接输出到控制台
        copyToClipboard(str);
    }
};

// 模拟 Alert
class Alert {
    constructor() {
        this.title = '';
        this.message = '';
    }
    addAction(title) {
        // 空实现
    }
    async present() {
        console.log(`模拟: Alert.present() - 标题: ${this.title}, 消息: ${this.message}`);
        print(`【${this.title}】\n${this.message}`);
    }
}

// 模拟 Notification
class Notification {
    constructor() {
        this.title = '';
        this.body = '';
    }
    async schedule() {
        console.log(`模拟: Notification.schedule() - 标题: ${this.title}, 正文: ${this.body}`);
    }
}

// 模拟 Script
const Script = {
    complete: () => {
        console.log("模拟: Script.complete() 被调用，脚本执行结束。");
    }
};

// 辅助函数 - 显示提醒
async function presentAlert(title, message) {
    const alert = new Alert();
    alert.title = title;
    alert.message = message;
    await alert.present();
}

// 主函数
async function main() {
    const clipboardText = Pasteboard.pasteString();
    if (!clipboardText || clipboardText.trim() === "") {
        console.log("Clipboard is empty.");
        await presentAlert("错误", "剪贴板为空，请先复制服务器信息。");
        return;
    }
    console.log("--- Input Text ---\n" + clipboardText + "\n--------------------");
    const parsedInfo = parseEmbyInfo(clipboardText);
    console.log("--- Parsed Info ---\n", parsedInfo, "\n-------------------");
    const finalUrl = generateSchemeUrl(parsedInfo);
    if (finalUrl) {
        console.log("--- Generated URL ---\n" + finalUrl + "\n---------------------");
        Pasteboard.copyString(finalUrl);
        const notification = new Notification();
        notification.title = "生成成功！";
        notification.body = "Scheme URL 已复制到剪贴板。";
        await notification.schedule();
        await presentAlert("成功", "Scheme URL 已成功生成并复制到剪贴板。");
    } else {
        console.error("Failed to parse a valid server address from the input text.");
        await presentAlert("解析失败", "未能在文本中找到有效的服务器地址。请检查您复制的内容。");
    }
    Script.complete();
}

// 解析Emby信息
function parseEmbyInfo(text) {
    const info = { username: '', password: '', lines: [] };
    const textLines = text.split('\n');
    let lastHost = null;
    const patterns = {
        username: /(?:用户名|用户名称)\s*[|：:]\s*([a-zA-Z0-9\-_]+)/,
        password: /(?:密码|用户密码)\s*[|：:]\s*(\S+)/,
        // 合并后的通用URL模式
        genericUrl: /((?:\w*线路|服务器|地址|当前线路|主机名|ip\w*|域名\w*|直连\w*)\s*)[|：:]\s*(https?:\/\/[a-zA-Z0-9.\-:]+)/,
        // 用于处理主机名格式的线路
        hostLineUrl: /(ip线路|域名线路|直连线路|主线路|备用线路|当前线路)\s*[|：:]\s*(\S+)/,
        standaloneUrl: /^(https?:\/\/[a-zA-Z0-9.\-:]+\/?)/,
        port: /(?:https? 端口|端口)\s*[|：:]\s*(\d{2,5})/,
    };
    for (const line of textLines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        let match = trimmedLine.match(patterns.username);
        if (match && !info.username) info.username = match[1];
        match = trimmedLine.match(patterns.password);
        if (match && !info.password) info.password = match[1];
        // 使用合并后的通用模式
        match = trimmedLine.match(patterns.genericUrl);
        if (match) {
            // 提取标签并处理
            const label = match[1].trim().replace('当前线路', '线路');
            info.lines.push({ title: label, url: match[2] });
            lastHost = null;
            continue;
        }
        // 处理主机名格式的线路（不以http开头）
        match = trimmedLine.match(patterns.hostLineUrl);
        if (match) {
            const title = match[1].replace('当前线路', '线路');
            const host = match[2];
            // 只有当不是完整URL时才作为lastHost处理
            if (!host.startsWith('http')) {
                lastHost = { title, host };
            } else {
                // 如果是完整URL，直接添加到线路列表
                info.lines.push({ title, url: host });
                lastHost = null;
            }
            continue;
        }
        match = trimmedLine.match(patterns.port);
        if (match && lastHost) {
            const port = match[1];
            const scheme = (port === '443') ? 'https' : 'http';
            const url = `${scheme}://${lastHost.host}:${port}`;
            info.lines.push({ title: lastHost.title, url });
            lastHost = null;
            continue;
        }
        match = trimmedLine.match(patterns.standaloneUrl);
        if (match) {
            if (!/wiki|faka|notion|t\.me|推荐|续费/.test(trimmedLine)) {
                info.lines.push({ title: '线路', url: match[1] });
                lastHost = null;
            }
            continue;
        }
    }
    const uniqueUrls = new Set();
    info.lines = info.lines.filter(line => {
        try {
            const urlObject = new URL(line.url);
            const normalizedUrl = urlObject.origin;
            if (uniqueUrls.has(normalizedUrl)) {
                return false;
            }
            uniqueUrls.add(normalizedUrl);
            return true;
        } catch (e) {
            console.error(`Invalid URL found and skipped: ${line.url}`);
            return false;
        }
    });
    return info;
}

// 生成Scheme URL
function generateSchemeUrl(info) {
    if (!info.lines || info.lines.length === 0) return null;
    const mainLineUrl = new URL(info.lines[0].url);
    const scheme = mainLineUrl.protocol.replace(':', '');
    const host = mainLineUrl.hostname;
    const port = mainLineUrl.port || (scheme === 'https' ? '443' : '80');
    
    // 定义通用标识列表
    const genericTitles = ['线路', '地址', '服务器'];
    
    // 如果第一条线路的标题是通用标识，则不设置title参数
    const firstLineTitle = info.lines[0].title || host;
    const title = genericTitles.includes(firstLineTitle) ? '' : firstLineTitle;
    
    // 不对任何参数进行编码处理
    let url = `forward://import?type=emby&scheme=${scheme}&host=${host}&port=${port}&username=${info.username}&password=${info.password}`;
    
    // 只有当title不为空时才添加title参数
    if (title) {
        url += `&title=${title}`;
    }
    
    // 从第二条线路开始添加线路参数，避免重复包含第一条线路
    info.lines.slice(1).forEach((line, index) => {
        const lineIndex = index + 2; // 从line2开始，因为line1就是主线路
        const normalizedUrl = line.url.endsWith('/') ? line.url.slice(0, -1) : line.url;
        
        // 如果线路标题是通用标识"线路"，则使用"备用线路"+索引的形式
        let lineTitle = line.title;
        if (lineTitle === '线路') {
            lineTitle = `备用线路${index + 1}`;
        }
        
        // 不对URL或标题进行编码处理
        url += `&line${lineIndex}=${normalizedUrl}&line${lineIndex}title=${lineTitle}`;
    });
    return url;
}

// 以下函数需要根据实际运行环境实现
// 获取剪贴板文本 - 需要具体实现
function getClipboardText() {
    // 这里应该根据实际运行环境实现获取剪贴板内容
    // 示例返回值
    return `用户名: testuser
密码: testpass
服务器地址: https://emby.example.com
ip线路: emby.example.com
端口: 443`;
}

// 复制到剪贴板 - 需要具体实现
function copyToClipboard(text) {
    // 这里应该根据实际运行环境实现复制到剪贴板
    console.log("已复制到剪贴板: " + text);
}

// 打印输出 - 可根据需要修改实现
function print(text) {
    // Node.js环境: 使用原始的console.log
    // 其他环境: 需要相应实现
    globalThis.console.log(text);
}

// 导出函数供外部调用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        main,
        parseEmbyInfo,
        generateSchemeUrl
    };
}

// 如果直接运行此脚本，则执行main函数
if (require.main === module) {
    main();
}
