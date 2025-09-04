/**
 * 御坂弹幕模块
 * 使用 /search/episodes 接口直接获取分集信息，提高效率
 * 给 module 指定 type 为 danmu 后，默认会携带以下参数：
 * tmdbId: TMDB ID，Optional
 * type: 类型，tv | movie
 * title: 搜索关键词
 * seriesName：剧名，Optional
 * episodeName：集名，Optional
 * airDate：播出日期，Optional
 * runtime：时长，Optional
 * premiereDate：首播日期，Optional
 * season: 季，电影时为空，Optional
 * episode: 集，电影时为空，Optional
 * link: 链接，Optional
 * videoUrl: 视频链接，Optional
 * commentId: 弹幕ID，Optional。在搜索到弹幕列表后实际加载时会携带
 * animeId: 动漫ID，Optional。在搜索到动漫列表后实际加载时会携带
 */

WidgetMetadata = {
    id: "misaka.danmaku.debug",
    title: "Misaka DEBUG",
    version: "1.0.0",
    requiredVersion: "0.0.2",
    description: "御坂弹幕模块",
    author: "QiXiuYuano",
    site: "https://github.com/QiXiuYuano/ForwardWidgets",
    globalParams: [
        {
            name: "server",
            title: "弹幕服务器",
            type: "input",
            placeholders: [
                {
                    title: "服务器地址",
                    value: "https://api.dandanplay.net",
                },
            ],
        },
        {
            name: "api_key",
            title: "外部API Key",
            type: "input",
            placeholders: [
                {
                    title: "API Key",
                    value: "",
                },
            ],
        },
    ],
    modules: [
        {
            //id需固定为searchDanmu
            id: "searchDanmu",
            title: "搜索弹幕",
            functionName: "searchDanmu",
            type: "danmu",
            params: [],
        },
        {
            //id需固定为getComments
            id: "getComments",
            title: "获取弹幕",
            functionName: "getCommentsById",
            type: "danmu",
            params: [],
        },
    ],
};

const PROVIDER_NAMES = {
    tencent: "腾讯视频",
    iqiyi: "爱奇艺",
    youku: "优酷视频",
    bilibili: "哔哩哔哩",
    mgtv: "芒果TV",
    renren: "人人影视",
    gamer: "巴哈姆特"
};


async function searchDanmu(params) {
    const { tmdbId, type, title, season, episode, server, api_key } = params;
    if (!server || !api_key) {
        throw new Error("server、api_key未配置");
    }
    // 从server参数中提取server_host
    let server_host;
    try {
        server_host = server.match(/^(https?:\/\/[^/]+)/i)[1];
    } catch (e) {
        console.error("无效的服务器地址");
        return;
    }

    let queryTitle = title;

    if (type === "tv" && season) {
        queryTitle = `${title} S${season}`;
    }

    let searchUrl = `${server}/api/v2/search/episodes?anime=${queryTitle}`;
    if (episode) {
        searchUrl += `&episode=${episode}`;
    }

    // 调用 /search/episodes API
    const response = await Widget.http.get(searchUrl, {
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "ForwardWidgets/1.0.0",
        },
    });

    if (!response) {
        throw new Error("获取数据失败");
    }

    const searchResult = response.data;

    if (!searchResult.success) {
        throw new Error(searchResult.errorMessage || "API调用失败");
    }

    if (!searchResult.animes || searchResult.animes.length === 0) {
        return {
            animes: []
        };
    }

    const anime = searchResult.animes[0];

    const sources = await getSourcesInfo({
        server_host,
        api_key,
        animeId: anime.animeId
    });

    const resultAnimes = anime.episodes.map((episode, index) => {
        let animeTitle;

        if (sources && sources[index] && sources[index].providerName) {
            const source = sources[index];
            const providerName = source.providerName;
            const displayName = PROVIDER_NAMES[providerName] || providerName;

            if (anime.type === "movie") {
                animeTitle = `[${displayName}] ${anime.animeTitle}`;
            } else {
                animeTitle = `[${displayName}] ${episode.episodeTitle}`;
            }
        } else {
            if (anime.type === "movie") {
                animeTitle = anime.animeTitle;
            } else {
                animeTitle = episode.episodeTitle;
            }
        }

        return {
            animeId: anime.animeId,
            animeTitle,
            episodeId: episode.episodeId,
        };
    });

    return {
        animes: resultAnimes
    };
}


async function getCommentsById(params) {
    const { animeId, episodeId, commentId, tmdbId, type, title, season, episode, server, api_key } = params;

    let danmakuId = commentId ?? episodeId;
    console.log(`danmakuId: ${danmakuId}`);

    if (danmakuId) {
        // 调用弹弹play弹幕API - 使用Widget.http.get
        const response = await Widget.http.get(
            `${server}/api/v2/comment/${danmakuId}?withRelated=true&chConvert=1`,
            {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "ForwardWidgets/1.0.0",
                },
            }
        );

        if (!response) {
            throw new Error("获取数据失败");
        }

        return response.data;
    }
    // return null;
    const debug_data = generateDanmu(`未读取到弹幕，animeId: ${animeId}, episodeId:${episodeId}`, 2);
    return debug_data;
}


async function getSourcesInfo(params) {
    const { server_host, api_key, animeId } = params;

    if (!server_host || !api_key || !animeId) {
        throw new Error("缺少必要参数: server, api_key, animeId");
    }

    let requestUrl = `${server_host}/api/control/library/anime/${animeId}/sources?api_key=${api_key}`;

    try {
        const response = await Widget.http.get(requestUrl, {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "ForwardWidgets/1.0.0",
            },
        });

        if (response && response.data) {
            return response.data;
        } else {
            console.warn("响应数据为空，返回null");
            return null;
        }
    } catch (error) {
        console.error(`获取数据源失败: ${error.message}`);
        return null;
    }
}

function generateDanmu(message, count) {
    const comments = [];
    const baseP = "1,1,25,16777215,1754803089,0,0,26732601000067074,1"; // 原始 p 字符串

    // 生成更多弹幕，每2秒一条，持续更长时间
    const totalDanmu = count * 30; // 生成30倍数量的弹幕
    for (let i = 0; i < totalDanmu; i++) {
        // 增加 cid
        const cid = i;

        // 修改 p 的第一位数字，每2秒一条弹幕
        const pParts = baseP.split(",");
        pParts[0] = (i * 2).toString(); // 每2秒一条弹幕，从0秒开始
        const updatedP = pParts.join(",");

        // 使用传入的 m 参数
        const m = message;

        // 生成每个弹幕对象
        comments.push({
            cid: cid,
            p: updatedP,
            m: m,
        });
    }

    return {
        count: comments.length,
        comments: comments,
    };
}
