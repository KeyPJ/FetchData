const axios = require("axios")
const fs = require("fs")
const path = require('path')
const sortJson = require('sort-json');

const options = { ignoreCase: true, reverse: false, depth: 10 };
axios.defaults.withCredentials = true

// 游戏配置及别名映射
const GAME_CONFIGS = {
    gi: { name: "原神" },
    hsr: { name: "崩坏：星穹铁道" },
    zzz: { name: "绝区零" }
};
const ALL_GAME_KEYS = Object.keys(GAME_CONFIGS);
const GAME_ALIASES = {
    // 可以添加别名，如 'genshin' 映射到 'gi'
    gi: 'gi',
    hsr: 'hsr',
    zzz: 'zzz'
};

// 游戏参数配置
const params = [
    { game: "gi", menu_id: "character", type: "character" },
    { game: "gi", menu_id: "weapon", type: "weapon" },
    { game: "hsr", menu_id: "character", type: "character" },
    { game: "hsr", menu_id: "lightcone", type: "weapon" },
    { game: "zzz", menu_id: "character", type: "character" },
    { game: "zzz", menu_id: "weapon", type: "weapon" },
];

// 获取请求配置
const getConfig = (game, menu_id) => ({
    method: 'get',
    url: `https://api.hakush.in/${game}/data/${menu_id}.json`,
    headers: {
        "sec-ch-ua": "\"Chromium\";v=\"130\", \"Google Chrome\";v=\"130\", \"Not?A_Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\""
    }
});

// 处理单个游戏的所有类型
async function processGame(gameKey) {
    console.log(`===== 开始处理 ${GAME_CONFIGS[gameKey].name} =====`);

    // 筛选当前游戏的所有参数配置
    const gameParams = params.filter(param => param.game === gameKey);

    for (const param of gameParams) {
        try {
            const game = param.game.replace("genshin", "gi");
            const menu_id = param.menu_id;
            const type = param.type;
            let list = [];

            const response = await axios(getConfig(game, menu_id));
            const data = response.data;

            const newData = Object.keys(data).reduce((acc, key) => {
                const item = data[key];
                let iconUrl = `/${game}/UI/${item.icon}.webp`;
                if (game === "hsr") {
                    iconUrl = `/${game}/UI/${type === "weapon" ? "lightconemediumicon" : "avatarshopicon"}/${key}.webp`;
                }
                const newKey = item.CHS || item.cn;
                acc[newKey] = {
                    iconUrl: iconUrl.replace("IconRole", "IconRoleSelect"),
                    cn: item.cn || item.CHS,
                    id: key,
                    EN: item.EN || item.en,
                    rank: item.rank,
                    type: item.type,
                    baseType: item.baseType,
                    element: item.element,
                    weapon: item.weapon,
                    damageType: item.damageType
                }
                return acc;
            }, {});

            if (newData) {
                console.log(`[${game}-${type}] 处理完成，共 ${Object.keys(newData).length} 项`);
                const directoryPath = path.join(__dirname, `../data/hakush/${game}`);
                if (!fs.existsSync(directoryPath)) {
                    fs.mkdirSync(directoryPath, { recursive: true });
                }
                const filePath = path.join(directoryPath, `${type}.json`);
                fs.writeFileSync(filePath, JSON.stringify(newData, null, "\t"));
                sortJson.overwrite(filePath, options);
            }
        } catch (error) {
            console.error(`[${param.game}-${param.type}] 处理出错:`, error.message);
        }
    }

    console.log(`===== ${GAME_CONFIGS[gameKey].name} 处理完成 =====`);
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

// 启动主函数
main();
