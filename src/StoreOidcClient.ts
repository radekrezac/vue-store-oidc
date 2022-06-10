import { OidcClient, OidcClientSettings, User, UserManager } from "oidc-client-ts"
import { RouteLocationNormalized } from "vue-router";
import { PayloadType } from ".";
import { OidcBrowserEvents } from ".";
import { OidcHelpers } from "."

export interface OidcSigninSilentOptions { ignoreErrors?: boolean }
export interface OidcSigninPopupOptions { ignoreErrors?: boolean }

export interface OidcSigninRedirectOptions {
  useReplaceToNavigate?: boolean;
  skipUserInfo?: boolean;
  extraQueryParams?: Record<string, any>;
}

export interface StoreOidcListeners {
  userLoaded?: (user: User) => void;
  userUnloaded?: () => void;
  accessTokenExpiring?: () => void;
  accessTokenExpired?: () => void;
  silentRenewError?: () => void;
  userSignedOut?: () => void;
  oidcError?: (payload?: PayloadType) => void;
  automaticSilentRenewError?: (payload?: PayloadType) => void;
  [key: string]: any;
}

export interface StoreOidcClientSettings extends OidcClientSettings {
  loginHint?: string;
  popupRedirectUri?: string;
  silentRedirectUri?: string;
  automaticSilentRenew?: boolean;
  automaticSilentSignin?: boolean;
  extraQueryParams?: Record<string, any>;
  [key: string]: any
}

export interface StoreOidcSettings {
  dispatchEventsOnWindow?: boolean;
  isPublicRoute?: (route: RouteLocationNormalized) => boolean;
  publicRoutePaths?: string[];
  routeBase?: string;
  defaultSigninRedirectOptions?: OidcSigninRedirectOptions;
  defaultSigninSilentOptions?: OidcSigninSilentOptions;
  defaultSigninPopupOptions?: OidcSigninPopupOptions;
  isAuthenticatedBy?: "access_token" | "id_token";
}

export class StoreOidcClient {
  private _oidcClient: OidcClient
  private _userManager: UserManager
  private _oidcClientSettings: StoreOidcClientSettings
  private _oidcStoreSettings: StoreOidcSettings
  private _oidcEventListeners: StoreOidcListeners

  constructor(oidcClientSettings: StoreOidcClientSettings, storeSettings?: StoreOidcSettings, oidcEventListeners?: StoreOidcListeners) {
    this._userManager = OidcHelpers.CreateUserManager(oidcClientSettings)
    this._oidcClient = OidcHelpers.CreateOidcClient(oidcClientSettings)
    this._oidcClientSettings = oidcClientSettings
    this._oidcStoreSettings = storeSettings ? storeSettings : {}
    // default authentication is set to id_token
    this._oidcStoreSettings.isAuthenticatedBy = storeSettings?.isAuthenticatedBy ? storeSettings.isAuthenticatedBy : "id_token"
    this._oidcEventListeners = oidcEventListeners ? oidcEventListeners : {}
  }
  get OidcCallbackPath() {
    return OidcHelpers.GetOidcCallbackPath(this._oidcClientSettings.redirect_uri, this._oidcStoreSettings.routeBase || '/')
  }
  get OidcPopupCallbackPath() {
    return OidcHelpers.GetOidcCallbackPath(this._oidcClientSettings.popupRedirectUri || '', this._oidcStoreSettings.routeBase || '/')
  }
  get OidcSilentCallbackPath() {
    return OidcHelpers.GetOidcCallbackPath(this._oidcClientSettings.silentRedirectUri || '', this._oidcStoreSettings.routeBase || '/')
  }
  RouteIsPublic = (route: RouteLocationNormalized) => {
    if (route.meta && route.meta.isPublic) {
      return true
    }
    if (route.meta && Array.isArray(route.meta) && route.meta.reduce((isPublic, meta) => meta.isPublic || isPublic, false)) {
      return true
    }
    if (this._oidcStoreSettings.publicRoutePaths && this._oidcStoreSettings.publicRoutePaths.map(path => path.replace(/\/$/, '')).indexOf(route.path.replace(/\/$/, '')) > -1) {
      return true
    }
    if (this._oidcStoreSettings.isPublicRoute && typeof this._oidcStoreSettings.isPublicRoute === 'function') {
      return this._oidcStoreSettings.isPublicRoute(route)
    }
    return false
  }
  RouteIsOidcCallback = (route: RouteLocationNormalized) => {
    if (route.meta && route.meta.isOidcCallback) {
      return true
    }
    if (route.meta && Array.isArray(route.meta) && route.meta.reduce((isOidcCallback, meta) => meta.isOidcCallback || isOidcCallback, false)) {
      return true
    }
    if (route.path && route.path.replace(/\/$/, '') === this.OidcCallbackPath) {
      return true
    }
    if (route.path && route.path.replace(/\/$/, '') === this.OidcPopupCallbackPath) {
      return true
    }
    if (route.path && route.path.replace(/\/$/, '') === this.OidcSilentCallbackPath) {
      return true
    }
    return false
  }
  DispatchCustomErrorEvent = (eventName: string, payload: {} | undefined) => {
    // oidcError and automaticSilentRenewError are not UserManagement events, they are events implemeted in vuex-oidc,
    if (typeof this._oidcEventListeners[eventName] === 'function') {
      this._oidcEventListeners[eventName](payload)
    }
    if (this._oidcStoreSettings.dispatchEventsOnWindow) {
      OidcBrowserEvents.DispatchCustomBrowserEvent(eventName, payload)
    }
  }
  get isAuthenticatedBy() {
    return this._oidcStoreSettings.isAuthenticatedBy
  }
  get UserManager() {
    return this._userManager
  }
  get OidcClient() {
    return this._oidcClient
  }
  get OidcClientSettings() {
    return this._oidcClientSettings
  }
  get OidcEventListeners() {
    return this._oidcEventListeners
  }
  get OidcStoreSettings() {
    return this._oidcStoreSettings
  }
}