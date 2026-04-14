"use client";

import { createContext, useEffect, useState } from "react";
import type { ProfileItem } from "@/types/types_v1";

type ProfileProps = {
  profileItems: ProfileItem[];
  setProfileItems: Function;
  currentProfileItem: ProfileItem;
  setCurrentProfileItem: Function;
  languageOptions: Options[];
  setLanguageOptions: Function;
};
type Options = {
  label: string;
  value: string;
};
export const ProfileContext = createContext({} as ProfileProps);

const DEFAULT_PROFILE: ProfileItem[] = [
  {
    profileId: 1,
    profileName: "默认配置",
  },
];
export const languageOption: Options[] = [
  { label: "English", value: "en" },
  { label: "简体中文", value: "zh" },
  { label: "繁体中文", value: "zh-Hant" },
  { label: "Pyсский", value: "ru" },
  { label: "한글", value: "ko" },
  { label: "日本語", value: "ja" },
];

function ProfileProvider({ children }) {
  const [profileItems, setProfileItems] = useState<ProfileItem[]>();
  const [currentProfileItem, setCurrentProfileItem] = useState<ProfileItem>();
  const [languageOptions, setLanguageOptions] =
    useState<Options[]>(languageOption);
  useEffect(() => {
    const localProfiles = localStorage.getItem("profiles");
    if (localProfiles && localProfiles !== "undefined") {
      const localProfilesArr = JSON.parse(localProfiles);
      if (Array.isArray(localProfilesArr)) {
        setProfileItems(localProfilesArr);
      }
    } else {
      setProfileItems(DEFAULT_PROFILE);
    }
  }, []);

  useEffect(() => {
    if (!profileItems) return;
    setCurrentProfileItem(profileItems[0]);
    localStorage.setItem("profiles", JSON.stringify(profileItems));
  }, [profileItems]);

  const profileProps = {
    profileItems: profileItems,
    setProfileItems: setProfileItems,
    currentProfileItem: currentProfileItem,
    setCurrentProfileItem: setCurrentProfileItem,
    languageOptions: languageOptions,
    setLanguageOptions: setLanguageOptions,
  };
  return (
    <ProfileContext.Provider value={profileProps}>
      {children}
    </ProfileContext.Provider>
  );
}

export default ProfileProvider;
