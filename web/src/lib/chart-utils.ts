// Portado de tremorlabs/template-dashboard (MIT, © 2025 Tremor Labs, Inc. — ver web/THIRD_PARTY_NOTICES.md).
// Tremor Raw chartColors [v0.0.0]

export type ColorUtility = "bg" | "stroke" | "fill" | "text"

export const chartColors = {
  // v12: a cor de destaque escolhida pela pessoa (escala brand-*, ver globals.css)
  brand: {
    bg: "bg-brand-600 dark:bg-brand-500",
    stroke: "stroke-brand-600 dark:stroke-brand-500",
    fill: "fill-brand-600 dark:fill-brand-500",
    text: "text-brand-700 dark:text-brand-400",
  },
  // laranja fixo do template-solar (o site público não muda com o destaque)
  orange: {
    bg: "bg-orange-600 dark:bg-orange-500",
    stroke: "stroke-orange-600 dark:stroke-orange-500",
    fill: "fill-orange-600 dark:fill-orange-500",
    text: "text-orange-700 dark:text-orange-400",
  },
  blue: {
    bg: "bg-blue-600 dark:bg-blue-500",
    stroke: "stroke-blue-600 dark:stroke-blue-500",
    fill: "fill-blue-600 dark:fill-blue-500",
    text: "text-blue-700 dark:text-blue-400",
  },
  emerald: {
    bg: "bg-emerald-600 dark:bg-emerald-500",
    stroke: "stroke-emerald-600 dark:stroke-emerald-500",
    fill: "fill-emerald-600 dark:fill-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  violet: {
    bg: "bg-violet-600 dark:bg-violet-500",
    stroke: "stroke-violet-600 dark:stroke-violet-500",
    fill: "fill-violet-600 dark:fill-violet-500",
    text: "text-violet-700 dark:text-violet-400",
  },
  amber: {
    bg: "bg-amber-600 dark:bg-amber-500",
    stroke: "stroke-amber-600 dark:stroke-amber-500",
    fill: "fill-amber-600 dark:fill-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  gray: {
    bg: "bg-gray-400 dark:bg-gray-600",
    stroke: "stroke-gray-400 dark:stroke-gray-600",
    fill: "fill-gray-400 dark:fill-gray-600",
    text: "text-gray-400 dark:text-gray-600",
  },
  cyan: {
    bg: "bg-cyan-600 dark:bg-cyan-500",
    stroke: "stroke-cyan-600 dark:stroke-cyan-500",
    fill: "fill-cyan-600 dark:fill-cyan-500",
    text: "text-cyan-700 dark:text-cyan-400",
  },
  indigo: {
    bg: "bg-indigo-600 dark:bg-indigo-500",
    stroke: "stroke-indigo-600 dark:stroke-indigo-500",
    fill: "fill-indigo-600 dark:fill-indigo-500",
    text: "text-indigo-600 dark:text-indigo-500",
  },
  pink: {
    bg: "bg-pink-500",
    stroke: "stroke-pink-500",
    fill: "fill-pink-500",
    text: "text-pink-500",
  },
  // v12: mais cores para categorias (600 no claro — ≥ 3:1 sobre branco como elemento gráfico)
  rose: {
    bg: "bg-rose-600 dark:bg-rose-500",
    stroke: "stroke-rose-600 dark:stroke-rose-500",
    fill: "fill-rose-600 dark:fill-rose-500",
    text: "text-rose-700 dark:text-rose-400",
  },
  sky: {
    bg: "bg-sky-600 dark:bg-sky-500",
    stroke: "stroke-sky-600 dark:stroke-sky-500",
    fill: "fill-sky-600 dark:fill-sky-500",
    text: "text-sky-700 dark:text-sky-400",
  },
  teal: {
    bg: "bg-teal-600 dark:bg-teal-500",
    stroke: "stroke-teal-600 dark:stroke-teal-500",
    fill: "fill-teal-600 dark:fill-teal-500",
    text: "text-teal-700 dark:text-teal-400",
  },
  red: {
    bg: "bg-red-600 dark:bg-red-500",
    stroke: "stroke-red-600 dark:stroke-red-500",
    fill: "fill-red-600 dark:fill-red-500",
    text: "text-red-700 dark:text-red-400",
  },
  lime: {
    bg: "bg-lime-600 dark:bg-lime-500",
    stroke: "stroke-lime-600 dark:stroke-lime-500",
    fill: "fill-lime-600 dark:fill-lime-500",
    text: "text-lime-700 dark:text-lime-400",
  },
  fuchsia: {
    bg: "bg-fuchsia-600 dark:bg-fuchsia-500",
    stroke: "stroke-fuchsia-600 dark:stroke-fuchsia-500",
    fill: "fill-fuchsia-600 dark:fill-fuchsia-500",
    text: "text-fuchsia-700 dark:text-fuchsia-400",
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string
  }
}

export type AvailableChartColorsKeys = keyof typeof chartColors

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as Array<AvailableChartColorsKeys>

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length]!)
  })
  return categoryColors
}

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: "bg-gray-500",
    stroke: "stroke-gray-500",
    fill: "fill-gray-500",
    text: "text-gray-500",
  }
  return chartColors[color]?.[type] ?? fallbackColor[type]
}

// Tremor Raw getYAxisDomain [v0.0.0]

export const getYAxisDomain = (
  autoMinValue: boolean,
  minValue: number | undefined,
  maxValue: number | undefined,
) => {
  const minDomain = autoMinValue ? "auto" : (minValue ?? 0)
  const maxDomain = maxValue ?? "auto"
  return [minDomain, maxDomain]
}

// Tremor Raw hasOnlyOneValueForKey [v0.1.0]

export function hasOnlyOneValueForKey(
  array: any[],
  keyToCheck: string,
): boolean {
  const val: any[] = []

  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      val.push(obj[keyToCheck])
      if (val.length > 1) {
        return false
      }
    }
  }

  return true
}
