const fs = require('fs');
const path = require('path');
const https = require('https');

// Common functions
function sortObjectById(obj) {
  return Object.fromEntries(
    Object.entries(obj).sort((a, b) => {
      const idA = a[1].id;
      const idB = b[1].id;
      if (!isNaN(idA) && !isNaN(idB)) {
        return parseInt(idA) - parseInt(idB);
      }
      return idA.localeCompare(idB);
    })
  );
}

async function getDeviceFp() {
  // Read device info from environment variables
  const deviceId = process.env.MIHOYO_DEVICE_ID ||'9d6ce9af-0e0e-4d8b-9d52-edd40c15e86a';
  const deviceFp = process.env.MIHOYO_DEVICE_FP ||'38d80929cfd78';

  if (!deviceId || !deviceFp) {
    console.error('MIHOYO_DEVICE_ID or MIHOYO_DEVICE_FP environment variables are not set');
    return {
      deviceId: '',
      deviceFp: ''
    };
  }

  console.log('Using device info from environment variables');
  return {
    deviceId: deviceId,
    deviceFp: deviceFp
  };
}

function loadExistingData(outputPath) {
  try {
    if (fs.existsSync(outputPath)) {
      const existingData = fs.readFileSync(outputPath, 'utf8');
      return JSON.parse(existingData);
    }
    return {};
  } catch (error) {
    console.error(`Error loading existing data: ${error.message}`);
    return {};
  }
}

function saveData(data, outputPath) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (Object.keys(data).length === 0) {
      const existingData = loadExistingData(outputPath);
      if (Object.keys(existingData).length > 0) {
        console.log(`Using existing data for ${outputPath}`);
        data = existingData;
      } else {
        console.log(`Warning: No data available for ${outputPath}, saving empty object`);
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Data saved to ${outputPath}`);
  } catch (error) {
    throw new Error(`Failed to save data: ${error.message}`);
  }
}

// GI-specific code
const OUTPUT_PATHS_GI = {
  CHARACTER: path.join(__dirname, '../data/miyoushe/gi/character.json'),
  WEAPON: path.join(__dirname, '../data/miyoushe/gi/weapon.json')
};

async function fetchApiData_GI(deviceInfo, endpoint, data) {
  return new Promise((resolve, reject) => {
    console.log(`Fetching GI data from ${endpoint} with device fp:`, deviceInfo.deviceFp);
    const cookie = process.env.MIHOYO_GI_COOKIE || process.env.MIHOYO_COOKIE
    if (!cookie) {
      console.error('MIHOYO_COOKIE environment variable is not set');
      resolve({});
      return;
    }

    const postData = JSON.stringify(data);

    const options = {
      hostname: 'api-takumi.mihoyo.com',
      path: endpoint,
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'referer': 'https://act.mihoyo.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'x-rpc-device_fp': deviceInfo.deviceFp,
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          console.log(`${endpoint} API response data length:`, data.length);
          const result = JSON.parse(data);
          if (result.data) {
            console.log(`${endpoint} API returned data successfully`);
            resolve(result.data);
          } else {
            console.error(`${endpoint} API error:`, result.message || 'Unknown error');
            resolve({});
          }
        } catch (error) {
          console.error(`Error parsing ${endpoint} data:`, error);
          resolve({});
        }
      });
    });

    req.on('error', (error) => {
      console.error(`${endpoint} API request error:`, error);
      resolve({});
    });

    req.write(postData);
    req.end();
  });
}

async function fetchCharacterData_GI(deviceInfo) {
  const characterData = await fetchApiData_GI(deviceInfo, '/event/e20200928calculate/v1/avatar/list', {
    "element_attr_ids": [],
    "weapon_cat_ids": [],
    "page": 1,
    "size": 200,
    "is_all": true,
    "lang": "zh-cn"
  });

  if (characterData && characterData.list) {
    console.log('Found', characterData.list.length, 'GI characters from API');
    const characters = {};
    characterData.list.forEach(character => {
      const name = character.name;
      if (name) {
        characters[name] = {
          cn: name,
          element: character.element_attr_id,
          EN: name, // 占位符，需要根据实际数据修改
          // "iconUrl": "https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_icon/67c7f6c8/503a481f314075541a0f7a1086995129.png",
          iconUrl: character.profile_pictures[0]?.icon.replace("https://act-webstatic.mihoyo.com", ""),
          id: character.id + "",
          rank: character.avatar_level,
          weapon: character.weapon_cat_id,
        }
      }
    });
    return sortObjectById(characters);
  } else {
    console.log('No GI character data found, returning empty object');
    return {};
  }
}

async function fetchWeaponData_GI(deviceInfo) {
  const weaponData = await fetchApiData_GI(deviceInfo, '/event/e20200928calculate/v1/weapon/list', {
    "weapon_cat_ids": [],
    "weapon_levels": [],
    "page": 1,
    "size": 1000,
    "lang": "zh-cn"
  });

  if (weaponData && weaponData.list) {
    console.log('Found', weaponData.list.length, 'GI weapons from API');
    const weapons = {};
    weaponData.list.forEach(weapon => {
      const name = weapon.name;
      if (name) {
        weapons[name] = {
          cn: name,
          EN: name, // 占位符，需要根据实际数据修改
          // "iconUrl": "https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_icon/67c7f6c8/0b590e80914fdb8e348323fff888be0c.png",
          iconUrl: weapon.icon.replace("https://act-webstatic.mihoyo.com",""),
          id: weapon.id + "",
          rank: weapon.weapon_level,
          type: weapon.weapon_cat_id
        };
      }
    });
    return sortObjectById(weapons);
  } else {
    console.log('No GI weapon data found, returning empty object');
    return {};
  }
}

async function main_GI() {
  try {
    console.log('=== Fetching GI Data ===');
    const deviceInfo = await getDeviceFp();

    const characters = await fetchCharacterData_GI(deviceInfo);
    console.log(`Found ${Object.keys(characters).length} GI characters`);

    const weapons = await fetchWeaponData_GI(deviceInfo);
    console.log(`Found ${Object.keys(weapons).length} GI weapons`);

    saveData(characters, OUTPUT_PATHS_GI.CHARACTER);
    saveData(weapons, OUTPUT_PATHS_GI.WEAPON);

    console.log('GI data fetched and saved successfully!');
  } catch (error) {
    console.error('Error fetching GI data:', error.message);
  }
}

// HSR-specific code
const OUTPUT_PATHS_HSR = {
  CHARACTER: path.join(__dirname, '../data/miyoushe/hsr/character.json'),
  WEAPON: path.join(__dirname, '../data/miyoushe/hsr/weapon.json')
};

async function fetchApiData_HSR(deviceInfo, endpoint) {
  return new Promise((resolve, reject) => {
    console.log(`Fetching HSR data from ${endpoint} with device fp:`, deviceInfo.deviceFp);
    const cookie = process.env.MIHOYO_HSR_COOKIE || process.env.MIHOYO_COOKIE
    if (!cookie) {
      console.error('MIHOYO_COOKIE environment variable is not set');
      resolve({});
      return;
    }

    const options = {
      hostname: 'act-api-takumi.mihoyo.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'referer': 'https://act.mihoyo.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'x-rpc-device_fp': deviceInfo.deviceFp,
        'Cookie': cookie
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          console.log(`${endpoint} API response data length:`, data.length);
          const result = JSON.parse(data);
          if (result.data) {
            console.log(`${endpoint} API returned data successfully`);
            resolve(result.data);
          } else {
            console.error(`${endpoint} API error:`, result.message || 'Unknown error');
            resolve({});
          }
        } catch (error) {
          console.error(`Error parsing ${endpoint} data:`, error);
          resolve({});
        }
      });
    });

    req.on('error', (error) => {
      console.error(`${endpoint} API request error:`, error);
      resolve({});
    });

    req.end();
  });
}

async function fetchCharacterData_HSR(deviceInfo) {
  const avatarData = await fetchApiData_HSR(deviceInfo, '/event/rpgcultivate/avatar/list?game=hkrpg&game_biz=hkrpg_cn&badge_region=prod_gf_cn&badge_uid=100960785');
  if (avatarData && avatarData.avatars) {
    console.log('Found', avatarData.avatars.length, 'HSR characters from API');
    const characters = {};
    avatarData.avatars.forEach(character => {
      const name = character.item_name || character.name;
      if (name) {
        characters[name] = {
          cn: name,
          damageType: character.damage_type,
          EN: name,
          // "iconUrl": "https://act-webstatic.mihoyo.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0250d/5f5e7e206018103619a60fd0fde2d5a9.png",
          iconUrl: character.icon_url.replace("https://act-webstatic.mihoyo.com/darkmatter",""),
          id: character.item_id,
          rank: character.rarity,
          baseType: character.avatar_base_type,
        };
      }
    });
    return sortObjectById(characters);
  } else {
    console.log('No HSR character data found, returning empty object');
    return {};
  }
}

async function fetchWeaponData_HSR(deviceInfo) {
  const equipmentData = await fetchApiData_HSR(deviceInfo, '/event/rpgcultivate/equipment/list?game=hkrpg&game_biz=hkrpg_cn&badge_region=prod_gf_cn&badge_uid=100960785');
  if (equipmentData && equipmentData.list) {
    console.log('Found', equipmentData.list.length, 'HSR weapons from API');
    const weapons = {};
    equipmentData.list.forEach(weapon => {
      const name = weapon.item_name;
      if (name) {
        weapons[name] = {
          cn: name,
          EN: name, // 占位符，需要根据实际数据修改
          // "iconUrl": "https://act-webstatic.mihoyo.com/darkmatter/hkrpg/prod_gf_cn/item_icon_u0250d/3b92ac1f080226da04e559c3d06d4dba.png",
          iconUrl: weapon.item_url.replace("https://act-webstatic.mihoyo.com/darkmatter",""),
          id: weapon.item_id,
          rank: weapon.rarity,
          baseType: weapon.avatar_base_type,
        };
      }
    });
    return sortObjectById(weapons);
  } else {
    console.log('No HSR weapon data found, returning empty object');
    return {};
  }
}

async function main_HSR() {
  try {
    console.log('=== Fetching HSR Data ===');
    const deviceInfo = await getDeviceFp();

    const characters = await fetchCharacterData_HSR(deviceInfo);
    console.log(`Found ${Object.keys(characters).length} HSR characters`);

    const weapons = await fetchWeaponData_HSR(deviceInfo);
    console.log(`Found ${Object.keys(weapons).length} HSR weapons`);

    saveData(characters, OUTPUT_PATHS_HSR.CHARACTER);
    saveData(weapons, OUTPUT_PATHS_HSR.WEAPON);

    console.log('HSR data fetched and saved successfully!');
  } catch (error) {
    console.error('Error fetching HSR data:', error.message);
  }
}

// ZZZ-specific code
const OUTPUT_PATHS_ZZZ = {
  CHARACTER: path.join(__dirname, '../data/miyoushe/zzz/character.json'),
  WEAPON: path.join(__dirname, '../data/miyoushe/zzz/weapon.json')
};

async function fetchApiData_ZZZ(deviceInfo) {
  return new Promise((resolve, reject) => {
    console.log('Fetching ZZZ data with device fp:', deviceInfo.deviceFp);
    const cookie = process.env.MIHOYO_3Z_COOKIE || process.env.MIHOYO_COOKIE || '_MHYUUID=9d6ce9af-0e0e-4d8b-9d52-edd40c15e86a; mi18nLang=zh-cn; DEVICEFP_SEED_ID=5ee742cebf221f61; DEVICEFP_SEED_TIME=1743924307097; DEVICEFP=38d80929cfd78; _ga_00MJSJTX01=GS1.1.1743930460.4.0.1743930460.0.0.0; _ga=GA1.2.1493892138.1743924307; _ga_X2T4KX119R=GS1.1.1746337839.4.0.1746337839.0.0.0; _ga_GYVLZWZNJ4=GS2.1.s1746337839$o4$g0$t1746337839$j0$l0$h0; account_mid_v2=04v6imppsu_mhy; account_id_v2=7233644; ltmid_v2=04v6imppsu_mhy; ltuid_v2=7233644; account_id=7233644; ltoken=YA8yQ18WbiaWA8T2bc13tBjhGygRHwdUh09O7BvL; ltuid=7233644; _qimei_uuid42=19c1201203a1002ebcd4be8ef5037288256c2818a8; _qimei_i_3=5efa2a84c65204d29494fd395ad770e2a1eeacf6415b0bd3b1da20512295243e603137943989e28da4ab; ltoken_v2=v2_8G6yOt50WytjHWkvhISSbL2xIORq_f7w0fLbVXeDhcv8blNgQIbl1M54O-BBOZUcY-DbJPwuLfntnUdH_w1qp1jkIHK0TsUE4PphmiP--ZHMRKeBBD3Nk8u-5aRcMhOhMJpPsMFlJHfHEJvRUw==.CAE=; _qimei_fingerprint=16ac6159a067a12f9652d0c1b2445583; MIHOYO_LOGIN_PLATFORM_LIFECYCLE_ID=aefffff7fb; cookie_token_v2=v2_LJlM7hTv4sFJP_e6RbhQG8D0NMxBoywQ74oDFuYhxZn7BDTV2YuBnu_1-HFc3a64PmNc21wMBOg4O040Zs-XbmUmC98jwF4WVjoodP9BvWSoSlTmKLKwcqSFmOzyBmZhyXh0MD-Chmqv2V-K.CAE=; cookie_token=zvjleVcekgxHOAHFvpPq40nMeJ7e3k5uRMaOykuU; e_hkrpg_token=OHFDjJhV+O74frBc+YnOJx4XeRRf4jRoaJ4Sj7/XUgMiwqPAMVnQ3lhxjihD+pQS; e_nap_token=AXcmd6UmcnA2eg5k+peJb4GIOrrxZZD4V+WCdjuCrxMBQvzBkMu8/SCGC1IV6DGK; SERVERID=12fa13afdffb176a18d4fc3753cf75b6|1772719516|1772719498; SERVERCORSID=12fa13afdffb176a18d4fc3753cf75b6|1772719516|1772719498'
    if (!cookie) {
      console.error('MIHOYO_COOKIE environment variable is not set');
      resolve({});
      return;
    }

    const options = {
      hostname: 'act-api-takumi.mihoyo.com',
      path: '/event/nap_cultivate_tool/user/item_list?uid=11552471&region=prod_gf_cn&avatar_id=1501&is_teaser=false',
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'referer': 'https://act.mihoyo.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'x-rpc-device_fp': deviceInfo.deviceFp,
        'Cookie': cookie
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          console.log('ZZZ API response data length:', data.length);
          const result = JSON.parse(data);
          if (result.data) {
            console.log('ZZZ API returned data successfully');
            resolve(result.data);
          } else {
            console.error('ZZZ API error:', result.message || 'Unknown error');
            resolve({});
          }
        } catch (error) {
          console.error('Error parsing ZZZ data:', error);
          resolve({});
        }
      });
    });

    req.on('error', (error) => {
      console.error('ZZZ API request error:', error);
      resolve({});
    });

    req.end();
  });
}

async function fetchCharacterData_ZZZ(deviceInfo) {
  const itemListData = await fetchApiData_ZZZ(deviceInfo);
  if (itemListData && itemListData.avatar_list) {
    console.log('Found', itemListData.avatar_list.length, 'ZZZ characters from API');
    const characters = {};
    itemListData.avatar_list.forEach(avatar => {
      const name = avatar.name_mi18n;
      characters[name] = {
        cn: name,
        element: avatar.element_type,
        EN: name, // 占位符，需要根据实际数据修改
        // iconUrl: `https://act-webstatic.mihoyo.com/game_record/zzzv2/role_square_avatar/role_square_avatar_${avatar.id}.png?x-oss-process=image/format,webp/quality,Q_90`,
        iconUrl: `/zzzv2/role_square_avatar/role_square_avatar_${avatar.id}.png?x-oss-process=image/format,webp/quality,Q_90`,
        id: avatar.id.toString(),
        rank: avatar.rarity === 'S' ? 5 : 4,
        type: avatar.avatar_profession
      };
    });
    return sortObjectById(characters);
  } else {
    console.log('No ZZZ character data found, returning empty object');
    return {};
  }
}

async function fetchWeaponData_ZZZ(deviceInfo) {
  const itemListData = await fetchApiData_ZZZ(deviceInfo);
  if (itemListData && itemListData.weapon) {
    console.log('Found', itemListData.weapon.length, 'ZZZ weapons from API');
    const weapons = {};
    itemListData.weapon.forEach(weapon => {
      weapons[weapon.name] = {
        cn: weapon.name,
        EN: weapon.name, // 占位符，需要根据实际数据修改
        // "https://act-webstatic.mihoyo.com/darkmatter/nap/prod_gf_cn/item_icon_u5fdgd/f07f870e5fa0acbf4e97b7d1947e9a3f.png",
        iconUrl: weapon.icon.replace("https://act-webstatic.mihoyo.com/darkmatter",""),
        id: weapon.id.toString(),
        rank: weapon.rarity === 'S' ? 5 : weapon.rarity === 'A' ? 4 : 3,
        type: weapon.profession
      }
    });
    return sortObjectById(weapons);
  } else {
    console.log('No ZZZ weapon data found, returning empty object');
    return {};
  }
}

async function main_ZZZ() {
  try {
    console.log('=== Fetching ZZZ Data ===');
    const deviceInfo = await getDeviceFp();

    const characters = await fetchCharacterData_ZZZ(deviceInfo);
    console.log(`Found ${Object.keys(characters).length} ZZZ characters`);

    const weapons = await fetchWeaponData_ZZZ(deviceInfo);
    console.log(`Found ${Object.keys(weapons).length} ZZZ weapons`);

    saveData(characters, OUTPUT_PATHS_ZZZ.CHARACTER);
    saveData(weapons, OUTPUT_PATHS_ZZZ.WEAPON);

    console.log('ZZZ data fetched and saved successfully!');
  } catch (error) {
    console.error('Error fetching ZZZ data:', error.message);
  }
}

// Main function to handle command line arguments
async function main() {
  const args = process.argv.slice(2);
  const game = args[0]?.toLowerCase();

  if (!game || game === 'all') {
    // Run all games
    await main_GI();
    await main_HSR();
    await main_ZZZ();
  } else if (game === 'gi') {
    await main_GI();
  } else if (game === 'hsr') {
    await main_HSR();
  } else if (game === 'zzz') {
    await main_ZZZ();
  } else {
    console.error('Invalid game argument. Use: gi, hsr, zzz, or all (default)');
    process.exit(1);
  }

  console.log('All tasks completed!');
}

if (require.main === module) {
  main();
}

module.exports = { main};
