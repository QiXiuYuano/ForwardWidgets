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
    id: "misaka.danmaku",
    title: "御坂弹幕模块",
    version: "1.0.1",
    requiredVersion: "0.0.2",
    description: "御坂弹幕模块，支持弹幕匹配及自动下载",
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
            functionName: "getComments",
            type: "danmu",
            params: [],
        },
    ],
};

async function searchDanmu(params) {
    const { tmdbId, type, title, season, episode, server, api_key } = params;
    if (!server) {
        throw new Error("server未配置");
    }

    let fileName;
    if (type === "tv" && season && episode) {
        // 剧集格式: "title.SxxExx.mkv"
        fileName = `${title}.S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}.mkv`;
    } else if (type === "movie") {
        // 电影格式: "title.mkv"
        fileName = `${title}.mkv`;
    } else {
        // 默认格式
        fileName = `${title}.mkv`;
    }

    try {
        let requestUrl = `${server}/api/v2/match`;
        const response = await Widget.http.post(requestUrl, {
            fileName: fileName
        }, {
            headers: {
                "Content-Type": "application/json",
            },
            timeout: 30,
        });

        const searchResult = response.data;

        if (!searchResult.matches || searchResult.matches.length === 0) {
            return {
                animes: [
                    {
                        animeTitle: title,
                        episodeTitle: "库中未匹配到资源, 触发下载",
                        tmdbId: tmdbId,
                        type: type,
                        season: season,
                        episode: episode
                    }
                ]
            };
        }

        const anime = searchResult.matches[0];

        return {
            animes: [
                {
                    animeId: anime.episodeId,
                    animeTitle: anime.animeTitle,
                    episodeTitle: anime.episodeTitle
                }
            ]
        };
    } catch (error) {
        if (error.message) {
            throw error;
        } else {
            throw new Error("网络请求失败: " + error.toString());
        }
    }
}


async function getComments(params) {
    const { animeId, type, title, season, episode, server } = params;

    if (animeId) {
        try {
            let commentId = animeId;
            const response = await Widget.http.get(
                `${server}/api/v2/comment/${commentId}?withRelated=true&chConvert=1`,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response) {
                throw new Error("获取数据失败");
            }

            return response.data;
        } catch (error) {
            if (error.message) {
                throw error;
            } else {
                throw new Error("获取弹幕失败: " + error.toString());
            }
        }
    }

    return {
        comments: []
    };
}
