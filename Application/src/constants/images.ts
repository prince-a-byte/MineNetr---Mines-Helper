/** Centralized local image registry. All screens import from here — never scatter require() calls. */
export const Images = {
  splashBg: require('../../assets/images/splash-bg.jpg'),
  loginArt: require('../../assets/images/login-art.jpg'),
  bannerHome: require('../../assets/images/banner-home.jpg'),
  mineDetail: require('../../assets/images/mine-detail.jpg'),
  mineLocation: require('../../assets/images/mine-location.jpg'),
  profileBanner: require('../../assets/images/profile-banner.jpg'),
  mines: {
    m1: require('../../assets/images/mine-bharatpur.jpg'),
    m2: require('../../assets/images/mine-kusunda.jpg'),
    m3: require('../../assets/images/mine-mugma.jpg'),
  },
  avatars: {
    WK001: require('../../assets/images/avatar-wk001.jpg'),
    WK002: require('../../assets/images/avatar-wk002.jpg'),
    WK003: require('../../assets/images/avatar-wk003.jpg'),
    WK004: require('../../assets/images/avatar-wk004.jpg'),
    WK005: require('../../assets/images/avatar-wk005.jpg'),
    WK006: require('../../assets/images/avatar-wk006.jpg'),
    WK007: require('../../assets/images/avatar-wk007.jpg'),
    WK008: require('../../assets/images/avatar-wk008.jpg'),
  } as Record<string, number>,
  avatarFallback: require('../../assets/images/avatar-ramesh.jpg'),
} as const;
