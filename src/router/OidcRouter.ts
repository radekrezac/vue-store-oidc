import { NavigationGuardNext, RouteLocationNormalized } from "vue-router"
import { OidcStoreMembers } from ".."

export const OidcRouter = {

    createRouterMiddleware: (store: OidcStoreMembers) => {
        return (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
          store.oidcCheckAccess(to)  
            .then((hasAccess: boolean) => {
              if (hasAccess) {
                next()
              }
            })
        }
      }
  
}