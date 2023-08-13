import { Point, SETTINGS, TribeType, randItem } from "webgl-test-shared";
import Board from "./Board";
import Tribe from "./Tribe";
import TribeTotem from "./entities/tribes/TribeTotem";
import TribeHut from "./entities/tribes/TribeHut";

/** Average number of spawn attempts that are done each second */
const TRIBE_SPAWN_RATE = 0.5;

const MAX_HUT_SPAWN_ATTEMPTS = 100;

const MIN_DISTANCE_FROM_OTHER_TRIBE = 4000;

const NUM_STARTING_HUTS: Record<TribeType, number> = {
   [TribeType.plainspeople]: 1,
   [TribeType.frostlings]: 1,
   [TribeType.barbarians]: 1,
   [TribeType.goblins]: 2
};

/** Minimum distance huts will spawn from other entities when they spawn */
const HUT_MIN_DISTANCES: Record<TribeType, number> = {
   [TribeType.plainspeople]: 200,
   [TribeType.frostlings]: 200,
   [TribeType.barbarians]: 200,
   [TribeType.goblins]: 100
}

const getTribeTypeForTile = (position: Point): TribeType | null => {
   const tile = Board.getTileAtPosition(position);

   const isGoblin = Math.random() < 0.25;
   if (isGoblin) {
      return TribeType.goblins;
   }

   switch (tile.biomeName) {
      case "grasslands": {
         return TribeType.plainspeople;
      }
      case "desert": {
         return TribeType.barbarians;
      }
      case "tundra": {
         return TribeType.frostlings;
      }
      case "mountains": {
         return TribeType.goblins;
      }
      default: {
         return null;
      }
   }
}

const isValidTribeSpawnPosition = (position: Point): boolean => {
   const tile = Board.getTileAtPosition(position);

   // Don't spawn in wall tiles or water
   if (tile.isWall || tile.type === "water") {
      return false;
   }

   // Don't spawn too close to other tribes
   for (const tribe of Board.getTribes()) {
      const distance = position.calculateDistanceBetween(tribe.totem.position);
      if (distance < MIN_DISTANCE_FROM_OTHER_TRIBE) {
         return false;
      }
   }
   
   return true;
}

const findValidHutPosition = (tribe: Tribe, otherBuildingPositions: ReadonlyArray<Point>): Point | null => {
   let numAttempts = 0;
   
   mainLoop: while (++numAttempts <= MAX_HUT_SPAWN_ATTEMPTS) {
      // Pick a random position within the tribe's area to spawn at
      const areaTiles = tribe.getArea();

      const tile = randItem(areaTiles);

      // Don't spawn huts in walls or water
      if (tile.isWall || tile.type === "water") {
         continue;
      }

      const x = (tile.x + Math.random()) * SETTINGS.TILE_SIZE;
      const y = (tile.y + Math.random()) * SETTINGS.TILE_SIZE;
      const position = new Point(x, y);

      const minHutDistance = HUT_MIN_DISTANCES[tribe.tribeType];

      // Make sure it isn't too close to any other buildings
      for (const buildingPosition of otherBuildingPositions) {
         const distance = position.calculateDistanceBetween(buildingPosition);
         if (distance < minHutDistance) {
            continue mainLoop;
         }
      }

      const entities = Board.getEntitiesInRange(position, minHutDistance);
      if (entities.length === 0) {
         return position;
      }
   }

   return null;
}

const spawnTribe = (position: Point, tribeType: TribeType): void => {
   const totem = new TribeTotem(position, false);
   const tribe = new Tribe(tribeType, totem);
   Board.addTribe(tribe);

   totem.rotation = 2 * Math.PI * Math.random();

   const buildingPositions: Array<Point> = [position];

   // Starting huts
   for (let i = 0; i < NUM_STARTING_HUTS[tribeType]; i++) {
      // Find a valid spawn position
      const hutPosition = findValidHutPosition(tribe, buildingPositions);

      if (hutPosition !== null) {
         const hut = new TribeHut(hutPosition, false, tribe);
         tribe.registerNewHut(hut);
         hut.rotation = 2 * Math.PI * Math.random();
         buildingPositions.push(hutPosition);
      }
   }
}

const runSpawnAttempt = (): void => {
   const x = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE * Math.random();
   const y = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE * Math.random();
   const spawnPosition = new Point(x, y);

   if (isValidTribeSpawnPosition(spawnPosition)) {
      const tribeType = getTribeTypeForTile(spawnPosition);
      if (tribeType !== null) {
         spawnTribe(spawnPosition, tribeType);
      }
   }
}

export function runTribeSpawnAttempt(): void {
   if(1+1==2)return;
   if (Math.random() < TRIBE_SPAWN_RATE) {
      runSpawnAttempt();
   }
}