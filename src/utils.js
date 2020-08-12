import Dinero from 'dinero.js'
import fastMemoize from 'fast-memoize'
import sortBy from 'lodash.sortby'

import shopInventory from './data/shop-inventory'
import fruitNames from './data/fruit-names'
import { cropIdToTypeMap, itemsMap } from './data/maps'
import { milk1, milk2, milk3 } from './data/items'
import { items as itemImages } from './img'
import { cowColors, cropLifeStage, genders, itemType } from './enums'
import {
  BREAKPOINTS,
  COW_MAXIMUM_AGE_VALUE_DROPOFF,
  COW_MAXIMUM_VALUE_MULTIPLIER,
  COW_MILK_RATE_FASTEST,
  COW_MILK_RATE_SLOWEST,
  COW_MINIMUM_VALUE_MULTIPLIER,
  COW_STARTING_WEIGHT_BASE,
  COW_STARTING_WEIGHT_VARIANCE,
  COW_WEIGHT_MULTIPLIER_MAXIMUM,
  COW_WEIGHT_MULTIPLIER_MINIMUM,
  HUGGING_MACHINE_ITEM_ID,
  INITIAL_FIELD_HEIGHT,
  INITIAL_FIELD_WIDTH,
  MALE_COW_WEIGHT_MULTIPLIER,
  MEMOIZE_CACHE_CLEAR_THRESHOLD,
  PRICE_EVENT_STANDARD_DURATION_DECREASE,
} from './constants'

const { SEED, GROWING, GROWN } = cropLifeStage

const shopInventoryMap = shopInventory.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})

const chooseRandom = list => list[Math.round(Math.random() * (list.length - 1))]

// Ensures that the condition argument to memoize() is not ignored, per
// https://github.com/caiogondim/fast-memoize.js#function-arguments
//
// Pass this is the `serializer` option to any memoize()-ed functions that
// accept function arguments.
const memoizationSerializer = args =>
  JSON.stringify(
    [...args].map(arg => (typeof arg === 'function' ? arg.toString() : arg))
  )

/**
 * @returns {string}
 */
const createUniqueId = () => btoa(Math.random() + Date.now())

// This is basically the same as fast-memoize's default cache, except that it
// clears the cache once the size exceeds MEMOIZE_CACHE_CLEAR_THRESHOLD to
// prevent memory bloat.
// https://github.com/caiogondim/fast-memoize.js/blob/5cdfc8dde23d86b16e0104bae1b04cd447b98c63/src/index.js#L114-L128
class MemoizeCache {
  cache = {}

  has(key) {
    return key in this.cache
  }

  get(key) {
    return this.cache[key]
  }

  set(key, value) {
    if (Object.keys(this.cache).length > MEMOIZE_CACHE_CLEAR_THRESHOLD) {
      this.cache = {}
    }

    this.cache[key] = value
  }
}

export const memoize = (fn, config) =>
  fastMemoize(fn, { cache: { create: () => new MemoizeCache() }, ...config })

/**
 * @param {number} num
 * @param {number} min
 * @param {number} max
 */
export const clampNumber = (num, min, max) =>
  num <= min ? min : num >= max ? max : num

export const castToMoney = num => Math.round(num * 100) / 100

/**
 * Safely adds dollar figures to avoid IEEE 754 rounding errors.
 * @param {...number} num Numbers that represent money values.
 * @returns {number}
 * @see http://adripofjavascript.com/blog/drips/avoiding-problems-with-decimal-math-in-javascript.html
 */
export const moneyTotal = (...args) =>
  args.reduce((sum, num) => (sum += Math.round(num * 100)), 0) / 100

/**
 * Based on https://stackoverflow.com/a/14224813/470685
 * @param {number} value Number to scale
 * @param {number} min Non-standard minimum
 * @param {number} max Non-standard maximum
 * @param {number} baseMin Standard minimum
 * @param {number} baseMax Standard maximum
 * @returns {number}
 */
const scaleNumber = (value, min, max, baseMin, baseMax) =>
  ((value - min) * (baseMax - baseMin)) / (max - min) + baseMin

export const createNewField = () =>
  new Array(INITIAL_FIELD_HEIGHT)
    .fill(undefined)
    .map(() => new Array(INITIAL_FIELD_WIDTH).fill(null))

/**
 * @param {number} number
 * @returns {string} Include dollar sign and other formatting, as well as cents.
 */
export const moneyString = number =>
  Dinero({ amount: Math.round(number * 100) }).toFormat()

/**
 * @param {number} number
 * @param {string} format
 * @see https://dinerojs.com/module-dinero#~toFormat
 * @returns {string}
 */
const formatNumber = (number, format) =>
  Dinero({ amount: Math.round(number * 100), precision: 2 })
    .convertPrecision(0)
    .toFormat(format)

/**
 * @param {number} number
 * @returns {string} Include dollar sign and other formatting. Cents are
 * rounded off.
 */
export const dollarString = number => formatNumber(number, '$0,0')

/**
 * @param {number} number
 * @returns {string} Number string with commas.
 */
export const integerString = number => formatNumber(number, '0,0')

/**
 * @param {farmhand.item} item
 * @param {Object.<number>} valueAdjustments
 * @returns {number}
 */
export const getItemValue = ({ id }, valueAdjustments) =>
  Dinero({
    amount: Math.round(
      (valueAdjustments[id]
        ? itemsMap[id].value *
          (itemsMap[id].doesPriceFluctuate ? valueAdjustments[id] : 1)
        : itemsMap[id].value) * 100
    ),
    precision: 2,
  }).toUnit()

/**
 * @param {Object} valueAdjustments
 * @param {string} itemId
 * @returns {number} Rounded to a money value.
 */
export const getAdjustedItemValue = (valueAdjustments, itemId) =>
  Number(((valueAdjustments[itemId] || 1) * itemsMap[itemId].value).toFixed(2))

/**
 * @param {farmhand.item} item
 * @returns {boolean}
 */
export const isItemSoldInShop = ({ id }) => Boolean(shopInventoryMap[id])

/**
 * @param {farmhand.item} item
 * @returns {number}
 */
export const getResaleValue = ({ id }) => itemsMap[id].value / 2

/**
 * @param {string} itemId
 * @returns {farmhand.crop}
 */
export const getCropFromItemId = itemId => ({
  ...getPlotContentFromItemId(itemId),
  daysOld: 0,
  daysWatered: 0,
  isFertilized: false,
  wasWateredToday: false,
})

/**
 * @param {string} itemId
 * @returns {farmhand.plotContent}
 */
export const getPlotContentFromItemId = itemId => ({
  itemId,
})

/**
 * @param {farmhand.plotContent} plotContent
 * @returns {string}
 */
export const getPlotContentType = ({ itemId }) => itemsMap[itemId].type

/**
 * @param {?farmhand.plotContent} plot
 * @returns {boolean}
 */
export const doesPlotContainCrop = plot =>
  plot && getPlotContentType(plot) === itemType.CROP

/**
 * @param {farmhand.item} item
 * @returns {boolean}
 */
export const isItemAGrownCrop = item =>
  Boolean(item.type === itemType.CROP && item.cropTimetable)

/**
 * @param {farmhand.item} item
 * @returns {boolean}
 */
export const isItemAFarmProduct = item =>
  Boolean(isItemAGrownCrop(item) || item.type === itemType.MILK)

/**
 * @param {farmhand.crop} crop
 * @returns {string}
 */
export const getCropId = ({ itemId }) =>
  cropIdToTypeMap[itemsMap[itemId].cropType]

/**
 * @param {farmhand.crop} crop
 * @returns {number}
 */
export const getCropLifecycleDuration = memoize(({ cropTimetable }) =>
  Object.values(cropTimetable).reduce((acc, value) => acc + value, 0)
)

/**
 * @param {farmhand.cropTimetable} cropTimetable
 * @returns {Array.<enums.cropLifeStage>}
 */
export const getLifeStageRange = memoize(cropTimetable =>
  [SEED, GROWING].reduce(
    (acc, stage) => acc.concat(Array(cropTimetable[stage]).fill(stage)),
    []
  )
)

/**
 * @param {farmhand.crop} crop
 * @returns {enums.cropLifeStage}
 */
export const getCropLifeStage = ({ itemId, daysWatered }) =>
  getLifeStageRange(itemsMap[itemId].cropTimetable)[Math.floor(daysWatered)] ||
  GROWN

const cropLifeStageToImageSuffixMap = {
  [SEED]: 'seed',
  [GROWING]: 'growing',
}

/**
 * @param {farmhand.plotContent} plotContent
 * @returns {?string}
 */
export const getPlotImage = plotContent =>
  plotContent
    ? getPlotContentType(plotContent) === itemType.CROP
      ? getCropLifeStage(plotContent) === GROWN
        ? itemImages[getCropId(plotContent)]
        : itemImages[
            `${getCropId(plotContent)}-${
              cropLifeStageToImageSuffixMap[getCropLifeStage(plotContent)]
            }`
          ]
      : itemImages[plotContent.itemId]
    : null

/**
 * @param {number} rangeSize
 * @param {number} centerX
 * @param {number} centerY
 * @returns {Array.<Array.<?farmhand.plotContent>>}
 */
export const getRangeCoords = (rangeSize, centerX, centerY) => {
  const squareSize = 2 * rangeSize + 1
  const rangeStartX = centerX - rangeSize
  const rangeStartY = centerY - rangeSize

  return new Array(squareSize)
    .fill()
    .map((_, y) =>
      new Array(squareSize)
        .fill()
        .map((_, x) => ({ x: rangeStartX + x, y: rangeStartY + y }))
    )
}

/**
 * @param {string} seedItemId
 * @returns {string}
 */
export const getFinalCropItemIdFromSeedItemId = seedItemId =>
  itemsMap[seedItemId].growsInto

/**
 * @param {farmhand.item} seedItem
 * @returns {farmhand.item}
 */
export const getFinalCropItemFromSeedItem = ({ id }) =>
  itemsMap[getFinalCropItemIdFromSeedItemId(id)]

/**
 * @param {farmhand.priceEvent} priceCrashes
 * @param {farmhand.priceEvent} priceSurges
 * @returns {Object}
 */
export const generateValueAdjustments = (priceCrashes, priceSurges) =>
  Object.keys(itemsMap).reduce((acc, key) => {
    if (itemsMap[key].doesPriceFluctuate) {
      if (priceCrashes[key]) {
        acc[key] = 0.5
      } else if (priceSurges[key]) {
        acc[key] = 1.5
      } else {
        acc[key] = Math.random() + 0.5
      }
    }

    return acc
  }, {})

/**
 * Generates a friendly cow.
 * @param {Object} [options]
 * @returns {farmhand.cow}
 */
export const generateCow = (options = {}) => {
  const gender = options.gender || chooseRandom(Object.values(genders))

  const baseWeight = Math.round(
    COW_STARTING_WEIGHT_BASE *
      (gender === genders.MALE ? MALE_COW_WEIGHT_MULTIPLIER : 1) -
      COW_STARTING_WEIGHT_VARIANCE +
      Math.random() * (COW_STARTING_WEIGHT_VARIANCE * 2)
  )

  const color = options.color || chooseRandom(Object.values(cowColors))

  return {
    baseWeight,
    color,
    colorsInBloodline: { [color]: true },
    daysOld: 1,
    daysSinceMilking: 0,
    gender,
    happiness: 0,
    happinessBoostsToday: 0,
    id: createUniqueId(),
    isUsingHuggingMachine: false,
    name: chooseRandom(fruitNames),
    weightMultiplier: 1,
    ...options,
  }
}

/**
 * Generates a cow based on two parents.
 * @param {farmhand.cow} cow1
 * @param {farmhand.cow} cow2
 * @returns {farmhand.cow}
 */
export const generateOffspringCow = (cow1, cow2) => {
  if (cow1.gender === cow2.gender) {
    throw new Error(
      `${JSON.stringify(cow1)} ${JSON.stringify(
        cow2
      )} cannot produce offspring because they have the same gender`
    )
  }

  const maleCow = cow1.gender === genders.MALE ? cow1 : cow2
  const femaleCow = cow1.gender === genders.MALE ? cow2 : cow1

  return generateCow({
    color: maleCow.color,
    colorsInBloodline: {
      // These lines are for backwards compatibility and can be removed on 11/1/2020
      [maleCow.color]: true,
      [femaleCow.color]: true,
      // End backwards compatibility lines to remove
      ...maleCow.colorsInBloodline,
      ...femaleCow.colorsInBloodline,
    },
    baseWeight: (maleCow.baseWeight + femaleCow.baseWeight) / 2,
  })
}

/**
 * @param {farmhand.cow} cow
 * @returns {farmhand.item}
 */
export const getCowMilkItem = ({ happiness }) => {
  if (happiness < 1 / 3) {
    return milk1
  } else if (happiness < 2 / 3) {
    return milk2
  }

  return milk3
}

/**
 * @param {farmhand.cow} cow
 * @returns {number}
 */
export const getCowMilkRate = cow =>
  cow.gender === genders.FEMALE
    ? scaleNumber(
        cow.weightMultiplier,
        COW_WEIGHT_MULTIPLIER_MINIMUM,
        COW_WEIGHT_MULTIPLIER_MAXIMUM,
        COW_MILK_RATE_SLOWEST,
        COW_MILK_RATE_FASTEST
      )
    : Infinity

/**
 * @param {farmhand.cow} cow
 * @returns {number}
 */
export const getCowWeight = ({ baseWeight, weightMultiplier }) =>
  Math.round(baseWeight * weightMultiplier)

/**
 * @param {farmhand.cow} cow
 * @returns {number}
 */
export const getCowValue = cow =>
  getCowWeight(cow) *
  clampNumber(
    scaleNumber(
      cow.daysOld,
      1,
      COW_MAXIMUM_AGE_VALUE_DROPOFF,
      COW_MAXIMUM_VALUE_MULTIPLIER,
      COW_MINIMUM_VALUE_MULTIPLIER
    ),
    COW_MINIMUM_VALUE_MULTIPLIER,
    COW_MAXIMUM_VALUE_MULTIPLIER
  )

/**
 * @param {farmhand.recipe} recipe
 * @param {Array.<farmhand.item>} inventory
 * @returns {boolean}
 */
export const canMakeRecipe = memoize(({ ingredients }, inventory) => {
  const inventoryQuantityMap = inventory.reduce((acc, { id, quantity }) => {
    acc[id] = quantity
    return acc
  }, {})

  return Object.keys(ingredients).every(
    itemId => inventoryQuantityMap[itemId] >= ingredients[itemId]
  )
})

/**
 * @type {Array.<farmhand.item>}
 */
const finalStageCropItemList = Object.keys(itemsMap).reduce((acc, itemId) => {
  const item = itemsMap[itemId]

  if (isItemAGrownCrop(item)) {
    acc.push(item)
  }

  return acc
}, [])

/**
 * @returns {farmhand.item} A final stage, non-seed item.
 */
export const getRandomCropItem = () =>
  finalStageCropItemList[
    Math.floor(Math.random() * finalStageCropItemList.length)
  ]

/**
 * @param {farmhand.item} cropItem
 * @returns {farmhand.priceEvent}
 */
export const getPriceEventForCrop = cropItem => ({
  itemId: cropItem.id,
  daysRemaining:
    getCropLifecycleDuration(cropItem) - PRICE_EVENT_STANDARD_DURATION_DECREASE,
})

/**
 * @param {Array.<Array.<?farmhand.plotContent>>} field
 * @param {function(?farmhand.plotContent)} condition
 * @returns {?farmhand.plotContent}
 */
export const findInField = memoize(
  (field, condition) => field.find(row => row.find(condition)) || null,
  {
    serializer: memoizationSerializer,
  }
)

// This is currently unused, but it could be useful later.
/**
 * @param {Array.<Array.<?farmhand.plotContent>>} field
 * @param {function(?farmhand.plotContent)} filterCondition
 * @returns {Array.<Array.<?farmhand.plotContent>>}
 */
export const getCrops = memoize(
  (field, filterCondition) =>
    field.reduce((acc, row) => {
      acc.push(...row.filter(filterCondition))

      return acc
    }, []),
  {
    serializer: memoizationSerializer,
  }
)

/**
 * @returns {boolean}
 */
export const doesMenuObstructStage = () => window.innerWidth < BREAKPOINTS.MD

const itemTypesToShowInReverse = new Set([itemType.MILK])

const sortItemIdsByTypeAndValue = memoize(itemIds =>
  sortBy(itemIds, [
    id => Number(itemsMap[id].type !== itemType.CROP),
    id => {
      const { type, value } = itemsMap[id]
      return itemTypesToShowInReverse.has(type) ? -value : value
    },
  ])
)

/**
 * @param {Array.<farmhand.item>} items
 * @return {Array.<farmhand.item>}
 */
export const sortItems = items => {
  const map = {}
  items.forEach(item => (map[item.id] = item))

  return sortItemIdsByTypeAndValue(items.map(({ id }) => id)).map(id => map[id])
}

/**
 * @param {Array.<farmhand.item>} inventory
 * @returns {number}
 */
export const inventorySpaceConsumed = memoize(inventory =>
  inventory.reduce((sum, { quantity }) => sum + quantity, 0)
)

/**
 * @param {{ inventory: Array.<farmhand.item>, inventoryLimit: number}} state
 * @returns {number}
 */
export const inventorySpaceRemaining = ({ inventory, inventoryLimit }) =>
  inventoryLimit === -1
    ? Infinity
    : inventoryLimit - inventorySpaceConsumed(inventory)

/**
 * @param {{ inventory: Array.<farmhand.item>, inventoryLimit: number}} state
 * @returns {boolean}
 */
export const doesInventorySpaceRemain = ({ inventory, inventoryLimit }) =>
  inventorySpaceRemaining({ inventory, inventoryLimit }) > 0

let isMouseDown = false
document.addEventListener('mousedown', () => (isMouseDown = true))
document.addEventListener('mouseup', () => (isMouseDown = false))
document.addEventListener('mouseleave', () => (isMouseDown = false))

/**
 * @return {boolean}
 */
export const isMouseHeldDown = () => isMouseDown

/**
 * @param {Array.<farmhand.item>} inventory
 * @return {boolean}
 */
export const areHuggingMachinesInInventory = memoize(inventory =>
  inventory.some(({ id }) => id === HUGGING_MACHINE_ITEM_ID)
)

// TODO: Use this function everywhere the null array pattern is used.
/**
 * @param {number} arraySize
 * @returns {Array.<null>}
 */
export const nullArray = memoize(arraySize =>
  Object.freeze(new Array(arraySize).fill(null))
)

/**
 * @param {Array.<farmhand.cow>} cowInventory
 * @param {string} id
 * @returns {farmhand.cow|undefined}
 */
export const findCowById = memoize((cowInventory, id) =>
  cowInventory.find(cow => id === cow.id)
)
