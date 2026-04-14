import { useEffect, useMemo, useState, useContext, useCallback } from "react";
import { KeyTravel } from "../types/types";
import {
  DeviceBaseInfo,
  FunInfo,
  AdvancedKey,
  KeyboardBase,
  KeyboardKey,
  KeyboardLight,
  LayoutKey,
  MacroProfile,
  ProfileContent,
  TravelConfig,
  TravelKey,
} from "../types/types_v1";
import { emptyProfile } from "../keyboard/defaultData";
import { ProfileContext } from "../providers/ProfileProvider";

export default function useKeyboard() {
  const [version, setVersion] = useState(0);
  const [keyboardType, setKeyboardType] = useState('');
  // 设备连接状态
  const [deviceStatus, setDeviceStatus] = useState(false);
  // 设备在线状态(有线模式默认为1，2.4G需要获取)
  const [deviceOnline, setDeviceOnline] = useState(false);
  // 设备模式（0: 有线; 1：2.4G; 2：蓝牙）
  const [deviceMode, setDeviceMode] = useState(0);
  // 设备类型 (区分多设备使用, 100 ~ 199 普通键盘, 200 ~ 299 磁轴键盘)
  const [deviceType, setDeviceType] = useState(101);

  // 设备升级文件
  const [deviceUpgradeFile, setDeviceUpgradeFile] = useState("");
  // 设备升级版本
  const [deviceUpgradeVersion, setDeviceUpgradeVersion] = useState("");
  // 设备固件版本
  const [deviceVersion, setDeviceVersion] = useState("");
  // 是否需要升级
  const [deviceNeedsUpgrade, setDeviceNeedsUpgrade] = useState(false);
  // 设备名称
  const [deviceName, setDeviceName] = useState("");
  // 设备VID
  const [deviceVID, setDeviceVID] = useState(0);
  // 设备PID
  const [devicePID, setDevicePID] = useState(0);

  // 配置方案
  const [profile, setProfile] = useState(1);
  // 按键Fn层
  const [fnLayer, setFnLayer] = useState(0);

  // 板载配置方案
  const [deviceProfile, setDeviceProfile] = useState(0);
  // 板载按键Fn层
  const [deviceFnLayer, setDeviceFnLayer] = useState(0);

  // 设备基本信息
  const [deviceBaseInfo, setDeviceBaseInfo] = useState<DeviceBaseInfo>();
  // 设备功能信息
  const [deviceFuncInfo, setDeviceFuncInfo] = useState<FunInfo>();

  // 灯光类型(backlight, logolight, sidelight)
  const [lightType, setLightType] = useState("backlight");
  // 按键颜色
  const [keysColor, setKeysColor] = useState([]);
  // 灯光矩阵
  const [lightMatrix, setLightMatrix] = useState([]);
  // 灯光预览
  const [lightPreview, setLightPreview] = useState(false);

  // 设备VID和PID
  const { profileItems, setProfileItems, currentProfileItem } =
    useContext(ProfileContext);
  const [travelMultiSelect, setTravelMultiSelect] = useState<Array<boolean>>(
    new Array(92).fill(false)
  );

  useEffect(() => {
    console.log(currentProfileItem, "currentProfileItem");
  }, [currentProfileItem]);
  const [remapSelectIndex, setRemapSelectIndex] = useState(-10);

  const [keysTravel, setKeysTravel] = useState<KeyTravel[]>([]);

  const [colorKeys, setColorKeys] = useState<Record<number, string[]>>({});

  const setTravelSelect = (index: number) => {
    setTravelMultiSelect((keys) => {
      return keys.map((key, idx) => (idx == index ? !key : key));
    });
  };

  const travelSelectAll = () => {
    setTravelMultiSelect(new Array(92).fill(true));
  };

  const travelUnselectAll = () => {
    setTravelMultiSelect(new Array(92).fill(false));
  };

  const travelRevSelect = () => {
    setTravelMultiSelect((keys) => {
      return keys.map((key) => !key);
    });
  };

  const setRemapSelect = (index: number) => {
    setRemapSelectIndex(index);
  };

  const changeKeysTravel = (keysTravel: KeyTravel[]) => {
    setKeysTravel(keysTravel);
  };

  const travelSelectIndex = (index: number[]) => {
    setTravelMultiSelect((keys) => {
      return keys.map((key, idx) => index.includes(idx));
    });
  };

  const addAdvancedKey = (type: string, keys: KeyboardKey[]) => { };

  const [layoutKeys, setLayoutKeys] = useState<LayoutKey[]>([]);
  //const [defaultKeys, setDefaultKeys] = useState([]);
  //const [userKeys, setUserKeys] = useState({ 0: new Array(92), 1: new Array(92), 2: new Array(92), 3: new Array(92) });

  const [defaultKeys, setDefaultKeys] = useState({});

  const [userKeys, setUserKeys] = useState<Record<string, KeyboardKey[]>>({});

  // QMK 键盘的所有层数据
  const [allQMKLayers, setAllQMKLayers] = useState<any[][]>([]);

  const [travelKeys, setTravelKeys] = useState<TravelKey[]>([]);

  const [selectIndex, setSelectIndex] = useState(-1);
  const [multiSelect, setMultiSelect] = useState<Array<boolean>>(
    new Array(92).fill(false)
  );

  const [advancedKey, setAdvancedKey] = useState<AdvancedKey>();
  const [advancedKeys, setAdvancedKeys] = useState<AdvancedKey[]>([]);

  const [advancedTwoKey, setAdvancedTwoKey] = useState<number[]>([-1, -1]);

  const [layer, setLayer] = useState(0);
  const [keyboardLight, setKeyboardLight] = useState<KeyboardLight>();

  const [travelConfig, setTravelConfig] = useState<TravelConfig>();

  const [keyboardBaseInfo, setKeyboardBaseInfo] = useState<KeyboardBase>();

  // 配置信息
  const [configInfo, setConfigInfo] = useState();

  // 轴体类型
  const [switchType, setSwitchType] = useState(0);
  // 轴体键程
  const [switchMaxTravel, setSwitchMaxTravel] = useState(3.4 * 100);
  // 轴体步进
  const [switchStep, setSwitchStep] = useState(0.01);
  // 轴体步进
  const [switchStepValue, setSwitchStepValue] = useState(100);

  const [testKeys, setTestKeys] = useState<number[]>(new Array(92).fill(0));

  const [travelTestKeys, setTravelTestKeys] = useState<number[]>(new Array(10).fill(0));
  const [isMultiSelect, setIsMultiSelect] = useState(false);

  const [profiles, setProfiles] = useState<ProfileContent[]>([]);
  const [profileIndex, setProfileIndex] = useState(-1);

  const resetColorKeys = (effect: number) => {
    if (effect > 0xe) {
      setColorKeys((colorKeys) => {
        if (colorKeys[effect] == undefined) {
          colorKeys[effect] = new Array(92).fill("");
        }
        return { ...colorKeys };
      });
    } else {
      setColorKeys({ 0: [] });
    }
  };

  useEffect(() => {
    setIsMultiSelect(multiSelect.some((select) => select));
  }, [multiSelect]);

  const canSelectAdvancedKey = (index: number) => {
    return true;
    return travelKeys[index].type == 0 || travelKeys[index].type == 6;
  };

  const createProfile = (newName: string) => {
    const newProfiles = [...profiles];
    newProfiles.push({
      ...emptyProfile,
      detail: { name: newName || "新建配置" + (newProfiles.length + 1) },
      userKeys: { ...userKeys },
      travelKeys: Array.from([...travelKeys]),
      advancedKeys: [...advancedKeys],
    });
    setProfiles(newProfiles);
  };

  const saveTravelKeys = (travelKeys: TravelKey[]) => {
    if (profileIndex < 0) return;
    setProfiles((profiles) => {
      console.log(profiles[0] ? profiles[0].travelKeys[0] : "");
      profiles[profileIndex].travelKeys = Array.from(travelKeys);
      return [...profiles];
    });
  };

  const saveUserKeys = () => {
    if (profileIndex < 0) return;
    setProfiles((profiles: ProfileContent[]) => {
      const newProfiles = profiles.map((profile, index) => {
        return index == profileIndex
          ? { ...profile, userKeys: { ...userKeys } }
          : profile;
      });

      return newProfiles;
    });
  };

  const saveGlobalTravel = () => {
    if (currentProfileItem.profileId < 0) return;
    console.log(travelConfig, "travelConfig");
    setProfiles((profiles: ProfileContent[]) => {
      return profiles.map((profile, index) => {
        return index == currentProfileItem.profileId
          ? { ...profile, globalTravel: { ...travelConfig } as TravelConfig }
          : profile;
      });
    });
    console.log(profiles, "profiles");
  };

  const saveLightConfig = () => {
    if (profileIndex < 0) return;
    setProfiles((profiles: ProfileContent[]) => {
      return profiles.map((profile, index) => {
        return index == profileIndex
          ? { ...profile, light: { ...keyboardLight } as KeyboardLight }
          : profile;
      });
    });
  };

  const saveKeyboardLight = (keyboardLight: KeyboardLight) => {
    if (profileIndex < 0) return;
    setProfiles((profiles: ProfileContent[]) => {
      return profiles.map((profile, index) => {
        return index == profileIndex
          ? { ...profile, light: { ...keyboardLight } }
          : profile;
      });
    });
  };

  const saveAdvancedKeys = (advancedKeys: AdvancedKey[]) => {
    if (profileIndex < 0) return;
    setProfiles((profiles: ProfileContent[]) => {
      profiles[profileIndex].advancedKeys = Array.from(advancedKeys);
      return [...profiles];
    });
  };

  const saveMacro = (macro: MacroProfile[]) => {
    if (profileIndex < 0) return;
    setProfiles((profiles: ProfileContent[]) => {
      return profiles.map((profile, index) => {
        return index == profileIndex
          ? { ...profile, macro: [...macro] }
          : profile;
      });
    });
  };

  const saveReportRate = (reportRate: number) => {
    if (profileIndex < 0) return;
    setProfiles((profiles: ProfileContent[]) => {
      return profiles.map((profile, index) => {
        return index == profileIndex ? { ...profile, reportRate } : profile;
      });
    });
  };

  const saveColorKeys = (colorKeys: string[], effect: number) => {
    if (profileIndex < 0) return;
    setProfiles((profiles: ProfileContent[]) => {
      return profiles.map((profile, index) => {
        return index == profileIndex
          ? {
            ...profile,
            colorKeys: { ...profile.colorKeys, [effect]: colorKeys },
          }
          : profile;
      });
    });
  };

  const initProfiles = () => {
    const res = localStorage.getItem("local_profiles");
    if (res) {
      const profiles = JSON.parse(res);
      setProfiles(profiles);
    }
  };

  useEffect(() => {
    if (profiles.length != 0) {
      localStorage.setItem("local_profiles", JSON.stringify(profiles));
    }
  }, [profiles]);

  const removeAdvancedKey = (index: number) => {
    advancedKeys.splice(index, 1);
    setAdvancedKeys([...advancedKeys]);
    saveAdvancedKeys([...advancedKeys]);
    return [...advancedKeys];
  };

  const resetKeyMode = (advancedKey: AdvancedKey) => {
    const { index1, index2 } = advancedKey;
    travelKeys[index1].type = 0;
    if (index2) {
      travelKeys[index2].type = 0;
    }
    updateTravelKeys([...travelKeys]);
    saveTravelKeys([...travelKeys]);
    return [...travelKeys];
  };

  const updateTravelKeys = (travelKeys: TravelKey[]) => {
    setTravelKeys(travelKeys);
  };

  const [editAdvancedKey, setEditAdvancedKey] = useState<AdvancedKey>();

  const [calibrationKeys, setCalibrationKeys] = useState<number[]>(
    new Array(200).fill(0)
  );
  const [calibration, setCalibration] = useState(false);

  const createLocalProfiles = (name: string) => {
    const newProfiles = [
      {
        ...emptyProfile,
        detail: { name },
        userKeys: { ...userKeys },
        travelKeys: Array.from([...travelKeys]),
        advancedKeys: [...advancedKeys],
      },
    ];
    setProfiles(newProfiles);
    setProfileIndex(0);
  };

  const [keyStatus, setKeyStatus] = useState(new Array(128).fill(0));
  const [keyTravel, setKeyTravel] = useState(new Array(128).fill(330));

  const setCheckStatus = (index, status) => {
    setKeyStatus((keyStatus) => {
      return keyStatus.map((keyStatus, idx) =>
        idx == index ? status : keyStatus
      );
    });
  };

  return {
    version,
    setVersion,
    keyboardType,
    setKeyboardType,
    deviceStatus,
    setDeviceStatus,
    deviceOnline,
    setDeviceOnline,
    deviceMode,
    setDeviceMode,
    deviceType,
    setDeviceType,

    // 设备升级文件
    deviceUpgradeFile,
    setDeviceUpgradeFile,
    // 设备升级版本
    deviceUpgradeVersion,
    setDeviceUpgradeVersion,
    // 设备固件版本
    deviceVersion,
    setDeviceVersion,
    // 是否需要升级
    deviceNeedsUpgrade,
    setDeviceNeedsUpgrade,

    deviceName,
    setDeviceName,
    deviceVID,
    setDeviceVID,
    devicePID,
    setDevicePID,

    // 本地配置
    profile,
    setProfile,
    fnLayer,
    setFnLayer,

    // 板载配置
    deviceProfile,
    setDeviceProfile,
    deviceFnLayer,
    setDeviceFnLayer,

    // 设备基本信息
    deviceBaseInfo,
    setDeviceBaseInfo,
    deviceFuncInfo,
    setDeviceFuncInfo,

    // 灯光类型(backlight, logolight, sidelight)
    lightType,
    setLightType,
    // 按键颜色
    keysColor,
    setKeysColor,
    // 灯光矩阵
    lightMatrix,
    setLightMatrix,
    // 灯光预览
    lightPreview,
    setLightPreview,

    saveTravelKeys,
    saveUserKeys,
    saveGlobalTravel,
    saveLightConfig,
    saveAdvancedKeys,
    saveMacro,
    saveColorKeys,
    saveKeyboardLight,
    saveReportRate,

    calibrationKeys,
    setCalibrationKeys,
    calibration,
    setCalibration,

    travelTestKeys,
    setTravelTestKeys,

    travelMultiSelect,
    remapSelectIndex,

    setTravelSelect,
    travelSelectAll,
    travelUnselectAll,
    travelRevSelect,
    travelSelectIndex,
    setRemapSelect,
    changeKeysTravel,
    keysTravel,
    addAdvancedKey,

    configInfo,
    setConfigInfo,

    switchType,
    setSwitchType,
    switchMaxTravel,
    setSwitchMaxTravel,
    switchStep,
    setSwitchStep,
    switchStepValue,
    setSwitchStepValue,

    layer,
    setLayer,

    testKeys,
    setTestKeys,

    keyboardBaseInfo,
    setKeyboardBaseInfo,

    selectIndex,
    setSelectIndex,

    isMultiSelect,

    multiSelect,
    multiSelectOne: (index: number) => {
      setMultiSelect((keys) => {
        return keys.map((key, idx) => (idx == index ? !key : key));
      });
    },
    multiSelectAll: () => {
      setMultiSelect(new Array(92).fill(true));
    },
    multiUnSelectAll: () => {
      setMultiSelect(new Array(92).fill(false));
    },
    multiRevSelect: () => {
      setMultiSelect((keys) => {
        return keys.map((key) => !key);
      });
    },
    multiSelectSome: (indexs: number[]) => {
      setMultiSelect((keys) => {
        return keys.map((key, idx) => indexs.includes(idx));
      });
    },

    layoutKeys,
    initLayoutKeys: (layoutKeys: LayoutKey[]) => {
      const newLayoutKeys = layoutKeys.map((key) => {
        return { ...key, index: key.row * 21 + key.col };
      });
      setLayoutKeys(newLayoutKeys);
    },

    defaultKeys,
    initDefaultKeys: (defaultKeys: KeyboardKey[]) => {
      setDefaultKeys(defaultKeys);
    },

    travelKeys,
    updateTravelKeys,
    getCurrentTravelKey: () => {
      return travelKeys[selectIndex];
    },

    travelConfig,
    setTravelConfig,

    userKeys,
    setUserKeys,

    // QMK 键盘的所有层数据
    allQMKLayers,
    setAllQMKLayers,
    // 更新 QMK 单个按键（触发 re-render）
    updateQMKKey: (layerIdx: number, keyIdx: number, newKey: any) => {
      setAllQMKLayers(prev => {
        const next = prev.map(l => [...l]);
        if (next[layerIdx]) next[layerIdx][keyIdx] = newKey;
        return next;
      });
    },

    advancedKey,
    advancedTwoKey,
    setAdvancedTwoKey,
    canSelectAdvancedKey,
    advancedKeys,
    setAdvancedKeys,

    editAdvancedKey,
    setEditAdvancedKey,

    resetKeyMode,

    // 高级键 rs、socd 模式选择键
    selectTwoKey: (index: number) => {
      if (advancedTwoKey.includes(index)) {
        if (advancedTwoKey[0] == index) {
          advancedTwoKey[0] = -1;
        }
        if (advancedTwoKey[1] == index) {
          advancedTwoKey[1] = -1;
        }
      } else {
        if (advancedTwoKey[0] == -1) {
          advancedTwoKey[0] = index;
        } else if (advancedTwoKey[1] == -1) {
          advancedTwoKey[1] = index;
        }
      }
      setAdvancedTwoKey([...advancedTwoKey]);
    },
    updateAllUserKeys: (allUserKeys: Record<string, KeyboardKey[]>) => {
      setUserKeys({ ...allUserKeys });
    },
    updateUserKeys: (
      keys: KeyboardKey[],
      profileIndex: number = 0,
      layer: number = 0
    ) => {
      setUserKeys((userKeys) => {
        return { ...userKeys, [layer]: [...keys] };
      });
    },
    updateUserKey: (
      key: KeyboardKey,
      index: number = -1,
      profileIndex: number = 0,
      layer: number = 0
    ) => {
      const targetIndex = index === -1 ? selectIndex : index;
      if (index !== -1) {
        setSelectIndex(index);
      }
      const newLayerKeys = [...(userKeys[layer] ?? [])];
      newLayerKeys[targetIndex] = key;
      setUserKeys((prev) => ({ ...prev, [layer]: newLayerKeys }));
    },

    updateDefaultKeys: (keys, layer) => {
      //初始化布局keys的index
      if (layer == 0) {
        setLayoutKeys((layoutKeys) => {
          return layoutKeys.map((key) => {
            return {
              ...key,
              index: keys.findIndex(
                (defaultKey) => defaultKey.code === key.code
              ),
            };
          });
        });
      }

      // 使用 keys.index 作为主键更新 defaultKeys
      setDefaultKeys((defaultKeys) => {
        return { ...defaultKeys, [layer]: [...keys] };
      });
    },

    colorKeys,
    updateAllColorKeys: (colorKeys: Record<number, string[]>) => {
      setColorKeys(colorKeys);
    },

    updateColorKeys: (colors: Array<string>, effect: number) => {
      colorKeys[effect] = colors;
      setColorKeys({ ...colorKeys });
    },
    updateColorKey: (index: number, color: string) => {
      if (!keyboardLight) {
        return;
      }
      const effect = keyboardLight?.effect;
      setColorKeys((colorKeys) => {
        colorKeys[effect][index] = color;
        return { ...colorKeys };
      });

      colorKeys[effect][index] = color;
      saveColorKeys([...colorKeys[effect]], effect);
    },

    keyboardLight,
    updateKeyboardLight: (
      keyboardLight: KeyboardLight,
      profileIndex: number = 0
    ) => {
      setKeyboardLight(keyboardLight);

      resetColorKeys(keyboardLight.effect);
    },
    createOrUpdateAdvancedKey: (advancedKey: AdvancedKey) => {
      const index = advancedKeys.findIndex(
        (key) =>
          advancedKey.index1 == key.index1 && advancedKey.type == key.type
      );
      if (index > -1) {
        advancedKeys[index] = advancedKey;
        setAdvancedKeys([...advancedKeys]);
        saveAdvancedKeys([...advancedKeys]);
        return [...advancedKeys];
      } else {
        setAdvancedKeys([...advancedKeys, advancedKey]);
        saveAdvancedKeys([...advancedKeys, advancedKey]);
        return [...advancedKeys, advancedKey];
      }
    },
    removeAdvancedKey,
    isAdvancedKey: (index: number) => {
      return (
        userKeys[layer][index].type &&
        [0x90, 0x91, 0x92, 0x93, 0x94].includes(userKeys[layer][index].type)
      );
    },
    setEditAdvancedKeyFromKeyIndex: (index) => {
      const advancedKey = advancedKeys.find(
        (key) => key.index1 == index || key.index2 == index
      );
      if (advancedKey) {
        setEditAdvancedKey(advancedKey);
      }
    },
    keyStatus,
    setCheckStatus,
    keyTravel,
    setKeyTravel,
    //profile
    profiles,
    setProfiles,

    profileIndex,
    setProfileIndex,

    initProfiles,

    createProfile,
    deleteProfile: (index: number) => {
      profiles.splice(index, 1);
      setProfileIndex(profiles.length - 1);
      setProfiles([...profiles]);
      if ([...profiles].length == 0) {
        localStorage.setItem("local_profiles", JSON.stringify([]));
      }
    },
    updateProfileName: (name: string, index: number) => {
      profiles[index].detail.name = name;
      setProfiles([...profiles]);
    },
    // createLocalProfiles,
  };
}
