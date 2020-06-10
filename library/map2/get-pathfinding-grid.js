// component renders a single chat bubble
const pathfindingGridFromImage = require('../features/pathfinding-grid-from-image')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const PF = require('pathfinding')

// utility function which generates and caches a pathfinding grid for each architecture level
let pathfindingGridCache = new WeakMap()

// given a Map object, returns a fresh unused Pathfinding library Grid
// grids are cached for as long as the map's room architecture object exists in memory
async function getPathfindingGrid(map, levelLabel = 'default') {
  let levels = pathfindingGridCache.get(map.room.architecture) || {}
  /** @type {PF.Grid} */
  let grid = levels[levelLabel]

  if (!grid) {
    let imageURL = map.room.architecturePath + uri`/${map.room.architecture.pathfinding}`
    grid = levels[levelLabel] = await pathfindingGridFromImage(imageURL, 512, map.cameraAngle)
  }

  pathfindingGridCache.set(map.room.architecture, levels)
  return grid.clone()
}

getPathfindingGrid.weakmap = new WeakMap()

module.exports = getPathfindingGrid