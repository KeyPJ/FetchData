const https = require('https');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml'); // 需要安装js-yaml包

// 游戏别名映射表 - 用于命令行参数解析
const GAME_ALIASES = {
    'gi': 'gi',       // 原神
    'hsr': 'hkrpg',   // 崩坏：星穹铁道
    'zzz': 'nap'      // 绝区零
};

// 所有游戏的键名列表
const ALL_GAME_KEYS = Object.values(GAME_ALIASES);

// 公共基础URL
const BASE_URL = 'https://operation-webstatic.mihoyo.com/gacha_info';

// 游戏配置映射表 - 直接通过键名确定星级
const GAME_CONFIGS = {
    gi: {
        name: '原神',
        path: 'hk4e/cn_gf01',
        types: {
            character: { ids: [301, 400], manualFile: '301.yaml' },
            weapon: { ids: [302], manualFile: '302.yaml' }
        },
        upFields: { fiveStar: 'r5_up_items', fourStar: 'r4_up_items' }
    },
    hkrpg: {
        name: '崩坏：星穹铁道',
        path: 'hkrpg/prod_gf_cn',
        types: {
            character: { ids: [11], manualFile: '11.yaml' },
            weapon: { ids: [12], manualFile: '12.yaml' }
        },
        upFields: { fiveStar: 'items_up_star_5', fourStar: 'items_up_star_4' }
    },
    nap: {
        name: '绝区零',
        path: 'nap/prod_gf_cn',
        types: {
            character: { ids: [2001, 2002, 2011, 2012], manualFile: '2001.yaml' },
            weapon: { ids: [3001, 3002, 3011, 3012], manualFile: '3001.yaml' }
        },
        upFields: { fiveStar: 'items_up_star_5', fourStar: 'items_up_star_4' }
    }
};

// 生成URL的工具函数
const getUrls = (path) => ({
    listUrl: `${BASE_URL}/${path}/gacha/list.json`,
    detailUrlPrefix: `${BASE_URL}/${path}/`
});

// 手动数据目录路径（与src同目录的data/manual）
const MANUAL_DATA_DIR = path.join(__dirname, '../data/manual');

// 工具函数：确保目录存在
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`已创建目录: ${dirPath}`);
    }
}

// 工具函数：发送HTTP请求 - 自动添加时间戳参数防止缓存
async function fetchData(url) {
    // 为URL添加时间戳参数，确保获取最新数据
    const timestamp = Date.now();
    const urlWithTs = url.includes('?')
        ? `${url}&ts=${timestamp}`
        : `${url}?ts=${timestamp}`;

    console.log(`\n请求数据: ${urlWithTs}`);
    return new Promise((resolve, reject) => {
        https.get(urlWithTs, res => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`HTTP错误: ${res.statusCode}`));
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(data.trim() ? JSON.parse(data) : {});
                } catch (e) {
                    reject(new Error(`解析失败: ${e.message}\n数据片段: ${data.substring(0, 200)}`));
                }
            });
        }).on('error', e => reject(new Error(`请求失败: ${e.message}`)));
    });
}

// 提取UP物品（直接通过键名确定星级）
function extractUpItems(detailData, config) {
    // 直接通过键名确定星级：fiveStar对应5星，fourStar对应4星
    const fiveStar = detailData[config.upFields.fiveStar] && Array.isArray(detailData[config.upFields.fiveStar])
        ? detailData[config.upFields.fiveStar]
            .filter(item => item?.item_name)
            .map(item => {
                console.log(`${config.name}提取5星UP: ${item.item_name}`);
                return item.item_name;
            })
        : [];

    const fourStar = detailData[config.upFields.fourStar] && Array.isArray(detailData[config.upFields.fourStar])
        ? detailData[config.upFields.fourStar]
            .filter(item => item?.item_name)
            .map(item => {
                console.log(`${config.name}提取4星UP: ${item.item_name}`);
                return item.item_name;
            })
        : [];

    console.log(`${config.name}提取结果 - 五星:`, fiveStar);
    console.log(`${config.name}提取结果 - 四星:`, fourStar);
    return { five: fiveStar, four: fourStar };
}

// 提取卡池名称（修复原神名称提取问题）
function getPoolName(title, game, gachaName) {
    // 优先使用详情页标题
    if (title) {
        // 尝试匹配「」之间的内容（适用于原神和大部分游戏）
        const match = title.match(/「([^」]+)」/);
        if (match) return match[1].replace(/<[^>]+>/g, '');

        // 移除HTML标签后的标题
        const cleanedTitle = title.replace(/<[^>]+>/g, '').trim();
        if (cleanedTitle) return cleanedTitle;
    }

    // 如果详情页标题无效，使用列表中的卡池名称
    if (gachaName) {
        const cleanedName = gachaName.replace(/<[^>]+>/g, '').trim();
        if (cleanedName) return cleanedName;
    }

    // 最终 fallback
    return '未知卡池';
}

// 读取YAML数据
function loadYaml(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const data = yaml.load(fs.readFileSync(filePath, 'utf8'));
            return Array.isArray(data) ? data : [];
        }
        return [];
    } catch (e) {
        console.error(`读取${filePath}失败:`, e.message);
        return [];
    }
}

// 在手动数据文件上追加或覆盖数据
function updateManualFile(manualFilePath, newData) {
    try {
        // 读取手动数据文件当前内容
        let manualData = loadYaml(manualFilePath);

        // 查找是否有相同起止时间的数据
        const existingIndex = manualData.findIndex(
            item => item.from === newData.from && item.to === newData.to
        );

        // 有相同时间范围则覆盖，否则追加
        if (existingIndex !== -1) {
            let oldData = manualData[existingIndex]
            if (oldData?.five?.length && newData.five.length > oldData.five.length) {
                manualData[existingIndex] = newData
                console.log(`已在手动文件中覆盖相同时间范围的数据: ${newData.name}`)
            }
        } else {
            manualData.push(newData);
            console.log(`已在手动文件中追加新数据: ${newData.name}`);
        }

        // 按时间排序（最新的在前面）
        manualData.sort((a, b) => new Date(b.from) - new Date(a.from));

        // 写入手动数据文件（原文件）
        fs.writeFileSync(
            manualFilePath,
            yaml.dump(manualData, { indent: 2, noRefs: true, skipInvalid: true }),
            'utf8'
        );
        console.log(`已更新手动数据文件: ${manualFilePath}`);
    } catch (e) {
        console.error(`更新手动文件失败:`, e.message);
    }
}

// 处理卡池数据并更新到对应的手动文件
async function processAndUpdateManual(gachaList, typeConfig, config, urls) {
    // 筛选目标卡池
    const targetPools = gachaList.filter(pool => typeConfig.ids.includes(pool.gacha_type));
    if (!targetPools.length) {
        console.log(`${config.name}未找到类型为${typeConfig.ids.join('、')}的卡池`);
        return;
    }

    console.log(`${config.name}找到${targetPools.length}个目标卡池`);

    // 构建手动数据文件路径
    const manualFilePath = path.join(MANUAL_DATA_DIR, typeConfig.manualFile);
    console.log(`将操作的手动数据文件: ${manualFilePath}`);

    // 获取详细数据
    const detailedPools = [];
    for (const pool of targetPools) {
        if (!pool.gacha_id) {
            console.log(`跳过无ID卡池: ${pool.gacha_name || '未知'}`);
            continue;
        }

        try {
            const detail = await fetchData(
                `${urls.detailUrlPrefix}${pool.gacha_id}/zh-cn.json`
            );

            console.log(`${config.name}字段状态:`, {
                [config.upFields.fiveStar]: detail[config.upFields.fiveStar] ? '存在' : '不存在',
                [config.upFields.fourStar]: detail[config.upFields.fourStar] ? '存在' : '不存在'
            });

            detailedPools.push({
                time: { from: pool.begin_time, to: pool.end_time },
                upItems: extractUpItems(detail, config),
                name: getPoolName(detail.title, config.key, pool.gacha_name)
            });
        } catch (e) {
            console.error(`获取${pool.gacha_name}数据失败:`, e.message);
        }
    }

    if (!detailedPools.length) return;

    // 按时间分组并更新到手动文件
    const timeGroups = {};
    detailedPools.forEach(pool => {
        const key = `${pool.time.from}|${pool.time.to}`;
        if (!timeGroups[key]) timeGroups[key] = {
            ...pool.time,
            items: { five: new Set(), four: new Set() },
            names: new Set()
        };

        pool.upItems.five.forEach(item => timeGroups[key].items.five.add(item));
        pool.upItems.four.forEach(item => timeGroups[key].items.four.add(item));
        timeGroups[key].names.add(pool.name);
    });

    // 保存到手动数据文件 - 名称之间使用无空格的|分隔
    Object.values(timeGroups).forEach(group => {
        updateManualFile(manualFilePath, {
            from: group.from,
            to: group.to,
            five: Array.from(group.items.five),
            four: Array.from(group.items.four),
            name: Array.from(group.names).join('|')
        });
    });
}

// 处理单个游戏
async function processGame(gameKey) {
    const config = { ...GAME_CONFIGS[gameKey], key: gameKey };
    if (!config) throw new Error(`不支持的游戏: ${gameKey}`);

    // 生成当前游戏的URL
    const urls = getUrls(config.path);

    console.log(`\n===== 开始处理${config.name} =====`);
    ensureDir(MANUAL_DATA_DIR); // 确保手动数据目录存在

    // 获取卡池列表
    const listData = await fetchData(urls.listUrl);
    if (listData?.retcode !== 0 || !Array.isArray(listData?.data?.list)) {
        throw new Error('无效的卡池列表数据');
    }

    console.log(`${config.name}发现${listData.data.list.length}个卡池`);

    // 处理角色卡池并更新到对应的手动文件
    await processAndUpdateManual(
        listData.data.list,
        config.types.character,
        config,
        urls
    );

    // 处理武器卡池并更新到对应的手动文件
    await processAndUpdateManual(
        listData.data.list,
        config.types.weapon,
        config,
        urls
    );

    console.log(`===== ${config.name}处理完成 =====\n`);
}

// 处理所有游戏
async function processAllGames() {
    console.log('===== 开始处理所有游戏 =====');

    for (const gameKey of ALL_GAME_KEYS) {
        try {
            await processGame(gameKey);
        } catch (e) {
            console.error(`处理${GAME_CONFIGS[gameKey]?.name || gameKey}时出错:`, e.message);
            console.log('继续处理下一个游戏...');
        }
    }

    console.log('===== 所有游戏处理完成 =====');
}

// 主函数 - 支持命令行参数和无参数执行全部
async function main() {
    try {
        // 获取命令行参数
        const args = process.argv.slice(2);

        if (args.length === 0) {
            // 无参数时执行全部游戏
            await processAllGames();
        } else {
            // 有参数时处理指定游戏
            const gameArg = args[0].toLowerCase();
            const gameKey = GAME_ALIASES[gameArg];

            if (!gameKey) {
                console.error(`不支持的参数: ${gameArg}`);
                console.log('支持的参数: gi, hsr, zzz (无参数则执行全部游戏)');
                return;
            }

            await processGame(gameKey);
            console.log('处理完成');
        }
    } catch (e) {
        console.error('执行错误:', e.message);
    }
}

main();
