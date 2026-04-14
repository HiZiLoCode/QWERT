"use client";

import { useState } from "react";
import { EditItem } from "../types/types";

function useEditList() {
  const [editList, setEditList] = useState<EditItem[]>([]);

  const addEditList = (action: string, oldValue: string, newValue: string) => {
    setEditList((editList) => {
      console.log(editList);
      return [...editList, { action, oldValue, newValue }];
    });
  };

  const removeEditList = () => {};

  const resetEditList = () => {
    setEditList([]);
  };

  return { editList, addEditList, removeEditList, resetEditList };
}

export default useEditList;
