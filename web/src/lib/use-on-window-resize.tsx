// Portado de tremorlabs/template-dashboard (MIT, © 2025 Tremor Labs, Inc. — ver web/THIRD_PARTY_NOTICES.md).
// Tremor Raw useOnWindowResize [v0.0.0]

import * as React from "react"

export const useOnWindowResize = (handler: { (): void }) => {
  React.useEffect(() => {
    const handleResize = () => {
      handler()
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [handler])
}
