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
    version: "1.0.0",
    requiredVersion: "0.0.2",
    description: "御坂弹幕模块，显示弹幕源、弹幕自动下载",
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
            functionName: "getComments",
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
            animeId: episode.episodeId,
            animeTitle: animeTitle,
            episodeTitle: episode.episodeTitle,
        };
    });
    return {
        animes: resultAnimes
    };
}



async function getComments(params) {
    const { animeId, type, title, season, episode, server, api_key } = params;

    if (animeId) {
        // 调用getCommentsById获取弹幕数据
        const comments = await getCommentsById({
            ...params,
            commentId: animeId
        });

        return comments;

    } else {
        try {
            // 检查必要参数
            if (!server || !api_key) {
                console.error("[错误] 服务器地址、api_key未配置");
                return null;
            }

            // 从server参数中提取server_host
            let server_host;
            try {
                server_host = server.match(/^(https?:\/\/[^/]+)/i)[1];
            } catch (e) {
                console.error("[错误] 无效的服务器地址");
                return null;
            }

            // 触发弹幕下载
            console.log("[调试] 开始下载弹幕...");
            const downloadResult = await downloadDanmu({ ...params, server_host });

            // 弹幕下载成功后，使用渐进式重试机制获取弹幕
            if (downloadResult && downloadResult.success) {
                console.log("[调试] 弹幕下载成功，尝试获取弹幕内容");
                const retryResult = await retryGetDanmuAfterDownload({
                    ...params,
                    downloadResult,
                });

                // 如果获取到弹幕，返回结果
                if (retryResult) {
                    console.log("[调试] 成功获取到下载的弹幕");
                    return retryResult;
                } else {
                    console.error("[错误] 下载后未能获取到弹幕内容");
                }
            } else {
                console.error(`[错误] 弹幕下载失败: ${downloadResult ? downloadResult.message : '未知错误'}`);
            }
        } catch (error) {
            console.error("[错误] 处理过程中出错:", error);
        }
    }

    return null;
}


async function getCommentsById(params) {

    const { server, commentId } = params;

    // 调用弹弹play弹幕API - 使用Widget.http.get
    const response = await Widget.http.get(
        `${server}/api/v2/comment/${commentId}?withRelated=true&chConvert=1`,
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

async function getSourcesInfo(params) {
    const { server_host, api_key, animeId } = params;

    if (!server_host || !api_key || !animeId) {
        console.error("[错误] 缺少必要参数: server, api_key, animeId");
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
            console.warn("[警告] 响应数据为空，返回null");
            return null;
        }
    } catch (error) {
        console.error(`[错误] 获取数据源失败: ${error.message}`);
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


/**
 * 弹幕下载函数
 */
async function downloadDanmu(params) {
    const { tmdbId, type, title, season, episode, server_host, api_key } =
        params;

    // 确定媒体类型
    const mediaType = type === "movie" ? "movie" : "tv_series";

    try {
        // 定义搜索策略
        let searchType, searchTerm;
        if (tmdbId) {
            searchType = "tmdb";
            searchTerm = tmdbId;
        } else {
            searchType = "keyword";
            searchTerm = title;
        }
        const result = await callImportAutoAPI({
            ...params,
            server_host,
            searchType,
            searchTerm,
            mediaType,
        });

        if (result.success) {
            // 调用弹幕下载API后，必须监控任务状态直到完成
            const downloadResult = await waitForDownloadCompletion(
                result.data.taskId,
                params
            );
            return downloadResult;
        }

        // 所有策略都失败了
        console.error("[错误] 弹幕下载失败：所有搜索策略都未成功");
        throw new Error("弹幕下载失败：所有搜索策略都未成功");
    } catch (error) {
        console.error("[错误] 弹幕下载错误:", error);
        throw new Error(`弹幕下载失败: ${error.message}`);
    }
}

/**
 * 调用弹幕服务端的 /api/control/import/auto 接口
 */
async function callImportAutoAPI(params) {
    const {
        server_host,
        api_key,
        searchType,
        searchTerm,
        season,
        episode,
        mediaType,
    } = params;

    // 构建请求URL
    const baseUrl = `${server_host}/api/control/import/auto`;
    const paramsObj = new URLSearchParams({
        searchType,
        searchTerm,
        api_key,
    });

    // 添加可选参数
    if (season) {
        paramsObj.append("season", season);
    }

    if (episode) {
        paramsObj.append("episode", episode);
    }

    if (mediaType) {
        paramsObj.append("mediaType", mediaType);
    }

    const requestUrl = `${baseUrl}?${paramsObj.toString()}`;

    console.log(`[调试] 弹幕下载请求URL:`, requestUrl);

    try {
        const response = await Widget.http.post(requestUrl, null, {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "ForwardWidgets/1.0.0",
            },
            timeout: 30, // 30秒超时，因为导入可能需要时间
        });

        console.log(`[调试] 弹幕服务端响应:`, response.data);

        // 检查响应状态
        if (response.status === 202) {
            return {
                success: true,
                data: response.data,
                searchType,
                searchTerm,
            };
        } else {
            console.error(`[错误] 服务端返回状态码: ${response.status}`);
            return {
                success: false,
                error: `服务端返回状态码: ${response.status}`,
                searchType,
                searchTerm,
            };
        }
    } catch (error) {
        console.error(`[错误] ${searchType} 搜索请求失败:`, error);
        return {
            success: false,
            error: error.message,
            searchType,
            searchTerm,
        };
    }
}

/*
 * 等待弹幕下载完成并返回最终结果
 */
async function waitForDownloadCompletion(schedulerTaskId, params) {
    console.log(
        `[调试] 等待弹幕下载完成，外部API自动导入ID: ${schedulerTaskId}`
    );

    try {
        // 轮询获取执行任务ID
        const executionTaskInfo = await pollForExecutionTaskId(schedulerTaskId, params);
        if (!executionTaskInfo) {
            return {
                success: false,
                message: "获取执行任务信息失败"
            };
        }

        // 检查是否获取到了执行任务ID
        if (!executionTaskInfo.executionTaskId) {
            // 未获取到执行任务ID，视为未找到执行任务
            return {
                success: false,
                message: "未找到弹幕下载执行任务，弹幕可能未成功下载"
            };
        }

        const executionTaskId = executionTaskInfo.executionTaskId;
        console.log(`[调试] 找到弹幕下载执行任务: ${executionTaskId}`);

        // 等待执行任务完成
        const executionTaskResult = await waitForTask(
            executionTaskId,
            "弹幕下载任务",
            params
        );

        // 返回弹幕下载的最终结果
        return {
            success: executionTaskResult.success,
            message: executionTaskResult.message
        };
    } catch (error) {
        console.error(`[错误] 等待下载完成出错:`, error);
        return {
            success: false,
            message: `监控弹幕下载过程出错: ${error.message}`
        };
    }
}

/**
 * 轮询获取执行任务ID
 */
async function pollForExecutionTaskId(schedulerTaskId, params) {
    const { server_host, api_key } = params;

    // 轮询配置
    let attempts = 0;
    const maxAttempts = 30; // 最多轮询30次
    const pollInterval = 5000; // 每5秒轮询一次

    console.log(`[调试] 开始轮询获取执行任务ID，调度任务ID: ${schedulerTaskId}`);

    try {
        while (attempts < maxAttempts) {
            const url = `${server_host}/api/control/tasks/${schedulerTaskId}/execution?api_key=${api_key}`;
            const response = await Widget.http.get(url, {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "ForwardWidgets/1.0.0",
                },
                timeout: 10,
            });

            if (response.status === 200) {
                const data = response.data;
                console.log(`[调试] 轮询结果:`, data);

                // 如果获取到了executionTaskId，直接返回
                if (data.executionTaskId) {
                    console.log(`[调试] 成功获取到执行任务ID: ${data.executionTaskId}`);
                    return data;
                }

                // 如果还未获取到executionTaskId，继续轮询
                console.log(`[调试] 暂未获取到执行任务ID，继续轮询... (尝试次数: ${attempts + 1}/${maxAttempts})`);
            } else {
                console.error(`[错误] 获取执行任务ID失败，HTTP状态码: ${response.status}`);
            }

            // 等待下一次轮询
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            attempts++;
        }

        // 轮询超时
        console.log(`[调试] 轮询获取执行任务ID超时`);
        return null;
    } catch (error) {
        console.error(`[错误] 轮询获取执行任务ID失败:`, error.message);
        return null;
    }
}

/**
 * 监控任务进度
 */
async function waitForTask(taskId, taskName, params) {
    let attempts = 0;
    const maxAttempts = 30; // 最多等待5分钟(10秒*30次)

    console.log(`[调试] 等待${taskName}完成: ${taskId}`);

    while (attempts < maxAttempts) {
        try {
            const taskInfo = await getTaskStatus(taskId, params);

            console.log(
                `[调试] ${taskName}状态: ${taskInfo.status}, 进度: ${taskInfo.progress}%`
            );

            // 检查任务是否完成
            if (taskInfo.status === "COMPLETED" || taskInfo.status === "已完成") {
                return {
                    success: true,
                    message: `${taskName}完成`,
                    taskId: taskId,
                    status: taskInfo.status,
                    progress: taskInfo.progress,
                    title: taskInfo.title,
                    description: taskInfo.description,
                };
            } else if (taskInfo.status === "FAILED" || taskInfo.status === "失败") {
                return {
                    success: false,
                    message: `${taskName}失败: ${taskInfo.description}`,
                    taskId: taskId,
                    status: taskInfo.status,
                    progress: taskInfo.progress,
                    title: taskInfo.title,
                    description: taskInfo.description,
                };
            }

            // 等待10秒后再次检查
            await new Promise((resolve) => setTimeout(resolve, 10000));
            attempts++;
        } catch (error) {
            console.error(
                `[错误] 检查${taskName}状态出错:`,
                error.message
            );
            attempts++;
        }
    }

    return {
        success: false,
        message: `${taskName}超时未完成`,
        taskId: taskId,
        status: "timeout",
        progress: 0,
    };
}

/**
 * 获取任务状态
 */
async function getTaskStatus(taskId, params) {
    const { server_host, api_key } = params;

    try {
        const url = `${server_host}/api/control/tasks/${taskId}?api_key=${api_key}`;
        const response = await Widget.http.get(url, {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "ForwardWidgets/1.0.0",
            },
            timeout: 10,
        });

        const status = response.status;
        const data = response.data;

        if (status === 200) {
            return data;
        } else if (status === 404) {
            console.error(`[错误] 任务不存在: ${taskId}`);
            throw new Error(`任务不存在: ${taskId}`);
        } else if (status === 401 || status === 403) {
            console.error("[错误] API认证失败，请检查API密钥");
            throw new Error("API认证失败，请检查API密钥");
        } else {
            console.error(`[错误] HTTP ${status}: ${JSON.stringify(data) || "未知错误"}`);
            throw new Error(`HTTP ${status}: ${JSON.stringify(data) || "未知错误"}`);
        }
    } catch (error) {
        console.error(`[错误] 获取任务状态失败:`, error);
        throw error;
    }
}

/**
 * 弹幕下载成功后，使用渐进式重试机制获取弹幕
 */
async function retryGetDanmuAfterDownload(params) {
    const { downloadResult, type, title, season, episode, server } = params;

    // 定义重试策略：尝试次数和间隔时间（毫秒）
    const retryStrategy = [
        { delay: 500, description: "立即重试" },
        { delay: 2000, description: "2秒后重试" },
        { delay: 5000, description: "5秒后重试" },
        { delay: 10000, description: "10秒后重试" },
    ];

    // 记录开始时间
    const startTime = Date.now();

    for (let i = 0; i < retryStrategy.length; i++) {
        const { delay, description } = retryStrategy[i];

        // 如果不是第一次尝试，等待指定时间
        if (delay > 0) {
            console.log(`[调试] 等待 ${delay}ms 后${description}`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        try {
            console.log(`[调试] 第 ${i + 1} 次尝试获取下载的弹幕`);

            const animes = await searchDanmu(params);

            // 现在searchDanmu已经返回了最佳的弹幕源，直接获取弹幕数据
            if (animes.animes.length > 0) {
                // 调用getCommentsById获取弹幕数据
                const comments = await getCommentsById({
                    ...params,
                    commentId: animes.animes[0].animeId
                });
                return comments;
            }

            console.log(`[调试] 第 ${i + 1} 次尝试未获取到弹幕内容`);
        } catch (error) {
            console.error(`[错误] 第 ${i + 1} 次尝试获取弹幕时出错:`, error.message);
        }
    }

    // 所有重试都失败了
    const elapsed = Date.now() - startTime;
    console.log(`[调试] 弹幕下载成功但获取弹幕内容失败，总耗时: ${elapsed}ms`);

    return null;
}
