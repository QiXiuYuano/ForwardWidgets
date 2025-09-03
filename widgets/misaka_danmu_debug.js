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
    id: "misaka.danmu.debug",
    title: "Misaka DEBUG",
    version: "1.0.0",
    requiredVersion: "0.0.2",
    description: "Misaka弹幕服务模块DEBUG",
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

// async function searchDanmu(params) {
//   const { tmdbId, type, title, season, episode, link, videoUrl, server } = params;

//   return {
//     animes: [
//       {
//         "animeId": 1101,
//         "bangumiId": "string",
//         "animeTitle": title,
//         "type": "tvseries",
//         "typeDescription": "string",
//         "imageUrl": "string",
//         "startDate": "2025-09-01T15:00:00.189Z",
//         "episodeCount": 12,
//         "rating": 0,
//         "isFavorited": true
//       }
//     ]
//   };
// }

async function searchDanmu(params) {
  const { tmdbId, type, title, season, episode, server } = params;

  let queryTitle = title;

  if (season) {
    queryTitle = `${title} S${season}`;
  }

  let searchUrl = `${server}/api/v2/search/episodes?anime=${queryTitle}`;
  if (episode) {
    searchUrl += `&episode=${episode}`;
  }

  // 调用 /search/episodes API - 使用Widget.http.get
  const response = await Widget.http.get(searchUrl, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "ForwardWidgets/1.0.0",
    },
  });

  if (!response) {
    throw new Error("获取数据失败");
  }

  const data = response.data;

  // 检查API返回状态
  if (!data.success) {
    throw new Error(data.errorMessage || "API调用失败");
  }

  // 直接从 /search/episodes 响应中获取番剧和分集信息
  let animes = [];
  if (data.animes && Array.isArray(data.animes) && data.animes.length > 0) {
    // 根据类型过滤番剧
    animes = data.animes.filter((anime) => {
      if (
        (anime.type === "tvseries" || anime.type === "web") &&
        type === "tv"
      ) {
        return true;
      } else if (anime.type === "movie" && type === "movie") {
        return true;
      } else {
        return false;
      }
    });
  }
  return {
    animes: animes,
  };
}


async function getCommentsById(params) {
    const { commentId, server, tmdbId, type, title, season, episode, link, videoUrl, seriesName,
        episodeName, airDate, runtime, premiereDate } = params;
    // const { commentId, server, link, videoUrl, season, episode, tmdbId, type, title } = params;

    let queryTitle = title;

    // 如果有season参数，调整title格式为 "title S{season}"
    if (season) {
        queryTitle = `${title} S${season}`;
    }

    let searchUrl = `${server}/api/v2/search/episodes?anime=${queryTitle}`;
    if (episode) {
        searchUrl += `&episode=${episode}`;
    }

    // 调用 /search/episodes API - 使用Widget.http.get
    const response = await Widget.http.get(searchUrl, {
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "ForwardWidgets/1.0.0",
        },
    });

    if (!response) {
        throw new Error("获取数据失败");
    }

    const searchData = response.data;

    // 检查API返回状态
    if (!searchData.success) {
        throw new Error(searchData.errorMessage || "API调用失败");
    }

    if (searchData.animes && Array.isArray(searchData.animes) && searchData.animes.length > 0) {
        const result = await getCommentsFromServer(searchData, server, tmdbId, type, title, season, episode);
        if (result) {
            return result;
        }
    } else {
        console.log('未找到相关剧集');
        return null;
    }
}

async function getCommentsFromServer(searchData, server, tmdbId, type, title, season, episode) {

    let animes = [];
    animes = searchData.animes.filter((anime) => {
        if (
            (anime.type === "tvseries" || anime.type === "web") &&
            type === "tv"
        ) {
            return true;
        } else if (anime.type === "movie" && type === "movie") {
            return true;
        } else {
            return false;
        }
    });

    let commentId;
    const anime = animes[0];
    if (anime.episodes && anime.episodes.length > 0) {
        const firstEpisode = anime.episodes[0];
        console.log(`找到分集: ${firstEpisode.episodeTitle} (ID: ${firstEpisode.episodeId})`);
        commentId = firstEpisode.episodeId;
    } else {
        console.log('未找到分集信息');
        return null;
    }

    if (commentId) {
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
    return null;
}