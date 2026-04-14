import { createContext, useState } from "react";
import useEditList from "../keyboard/useEditList";
import useKeyboard from "../hooks/useKeyBoard";
import {
  AdvancedKeyItem,
  KeyItem,
  useKeyboardReturnProps,
} from "@/types/types";

type Key = {
  row: number;
  col: number;
};

type ColorKey = Key & { value: string };

type KeyBoardFun = {
  colors: ColorKey[];
  changeColor: Function;
  activeKey: Key | undefined;
  setActiveKey: Function;
  isActive: boolean;
  cancelActive: Function;
  advancedKeys: AdvancedKeyItem[] | undefined;
  addAdvancedKey: Function;
  removeAdvancedKey: Function;
  lightingKey: {
    colors: ColorKey[];
    changeColors: Function;
    color: string;
    onChangeColor: Function;
    onResetColors: Function;
  };
  advancedKey: {
    advancedKeys: AdvancedKeyItem[] | undefined;
    addAdvancedKey: Function;
    removeAdvancedKey: Function;
  };
  selectedKeyIndex: number;
  setSelectedKeyIndex: Function;
  selectveViewPort: string;
  setSelectiveViewport: Function;
  baseKey: {
    addEditList: Function;
  };
  selectedKey: KeyItem | undefined;
  setSelectedKey: Function;
  customColor: boolean;
  setCustomColor: Function;
  keyboardCtx: useKeyboardReturnProps;
  selectColor: string;
  setSelectColor: Function;
};

export const KeyBoardContext = createContext({} as KeyBoardFun);

function KeyBoardProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<ColorKey[]>([]);
  const [selectveViewPort, setSelectiveViewport] = useState<string>("devices");
  const [activeKey, setActiveKey] = useState<Key>();
  const [advancedKeys, setAdvancedKeys] = useState<AdvancedKeyItem[]|undefined>();
  const [baseKeys, setBaseKeys] = useState();
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(-1);
  const { addEditList } = useEditList();
  const [color, setColor] = useState("#336dff");
  const [selectColor, setSelectColor] = useState("#ff0000");
  const [selectedKey, setSelectedKey] = useState<KeyItem>();

  const [customColor, setCustomColor] = useState(false);

  const keyboardCtx = useKeyboard();

  const keyboardFun: KeyBoardFun = {
    colors: colors,
    changeColor: (col: number, row: number, color: string) => {
      setColors((colors) => {
        const newColors = colors.map((item) => {
          if (item.col == col && item.row == row) {
            return { ...item, color };
          }
          return item;
        });
        return newColors;
      });
    },
    activeKey: activeKey,
    setActiveKey: (col: number, row: number) => {
      setActiveKey({ col, row });
    },
    isActive: !!activeKey,
    cancelActive: () => {
      setActiveKey(undefined);
    },
    advancedKeys: advancedKeys,
    addAdvancedKey: (advancedKey: AdvancedKeyItem) => {
      setAdvancedKeys((itemArr) =>
        itemArr ? [...itemArr, advancedKey] : [advancedKey]
      );
    },
    removeAdvancedKey: (keyCode) => {
      // setAdvancedKeys((itemArr) => itemArr?.filter((item) => item.key.code1 != keyCode) || [])
    },
    lightingKey: {
      colors: colors,
      changeColors: (row, col, color) => {},
      color: color,
      onChangeColor: (color) => {
        setColor(color);
      },
      onResetColors: () => {},
    },
    advancedKey: {
      advancedKeys: advancedKeys,
      addAdvancedKey: () => {},
      removeAdvancedKey: () => {},
    },
    selectedKeyIndex: selectedKeyIndex,
    setSelectedKeyIndex: setSelectedKeyIndex,
    selectveViewPort:selectveViewPort,
    setSelectiveViewport:setSelectiveViewport,
    baseKey: {
      addEditList: addEditList,
    },
    selectedKey,
    setSelectedKey,
    customColor,
    setCustomColor,
    keyboardCtx,
    selectColor,
    setSelectColor,
  };
  return (
    <KeyBoardContext.Provider value={keyboardFun}>
      {children}
    </KeyBoardContext.Provider>
  );
}

export default KeyBoardProvider;
