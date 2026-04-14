'use client'

import { Fragment } from "react";
import DragKey from "./DragKey";
import KeyBox from "./KeyBox";

function DKSKeys({advancedKeyItem, onChange, onRemoveKey}) {
  const changeDKSKey = (index, key) => {
    const newDksKeys = advancedKeyItem?.dksKeys?.map((item, i) => {
      return i == index ? {...item, key} : item;
    })
    onChange({...advancedKeyItem, dksKeys: newDksKeys});
  }
  const onChangeDksStatus = (index, status) => {
    const newDksKeys = advancedKeyItem?.dksKeys?.map((item, i) => {
      return i == index ? {...item, ...status} : item;
    })
    onChange({...advancedKeyItem, dksKeys: newDksKeys});
  }

return (<>
  {advancedKeyItem.dksKeys?.map((item, index) =>(
    <Fragment key={index}>
      <div onClick={() => onRemoveKey(index)}>
        <KeyBox keyCode={item?.key?.name|| ''} size={16} onDrop={(key) => changeDKSKey(index, key)} />
      </div>
      <DragKey dksKey={item} onChange={(status) => {onChangeDksStatus(index, status)}}/>
    </Fragment>
  ))}</>)
}

export default DKSKeys;