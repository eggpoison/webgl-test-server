import { BiomeName, EntityType, IEntityType, ItemType, PlayerCauseOfDeath, Point, SETTINGS, Vector, parseCommand, randItem } from "webgl-test-shared";
import { SERVER } from "./server";
import { getTilesOfBiome } from "./census";
import Board from "./Board";
import Item from "./Item";
import Tile from "./Tile";
import { damageEntity, healEntity } from "./components/HealthComponent";
import Entity, { NUM_ENTITY_TYPES } from "./GameObject";
import { InventoryComponentArray } from "./components/ComponentArray";
import { addItem } from "./components/InventoryComponent";
import { createEntity } from "./entity-creation";

const ENTITY_SPAWN_RANGE = 200;

const killPlayer = (player: Entity): void => {
   damageEntity(player, 999999, 0, null, null, PlayerCauseOfDeath.god, 0);
}

const damagePlayer = (player: Entity, damage: number): void => {
   damageEntity(player, damage, 0, null, null, PlayerCauseOfDeath.god, 0);
}

const setTime = (time: number): void => {
   Board.time = time;
}

const giveItem = (player: Entity, itemType: ItemType, amount: number): void => {
   if (amount === 0) {
      return;
   }

   const item = new Item(itemType, amount);
   addItem(InventoryComponentArray.getComponent(player), item);
}

const tp = (player: Entity, x: number, y: number): void => {
   const newPosition = new Point(x, y);
   SERVER.sendForcePositionUpdatePacket(player, newPosition);
}

const tpBiome = (player: Entity, biomeName: BiomeName): void => {
   const potentialTiles = getTilesOfBiome(biomeName);
   if (potentialTiles.length === 0) {
      console.warn(`No available tiles of biome '${biomeName}' to teleport to.`);
      return;
   }

   let numAttempts = 0;
   let tile: Tile;
   do {
      tile = randItem(potentialTiles);
      if (++numAttempts === 999) {
         return;
      }
   } while (tile.isWall);
   
   const x = (tile.x + Math.random()) * SETTINGS.TILE_SIZE;
   const y = (tile.y + Math.random()) * SETTINGS.TILE_SIZE;

   const newPosition = new Point(x, y);
   SERVER.sendForcePositionUpdatePacket(player, newPosition);
}

const summonEntities = (player: Entity, unguardedEntityType: number, amount: number): void => {
   if (!Number.isInteger(unguardedEntityType) || unguardedEntityType < 0 || unguardedEntityType >= NUM_ENTITY_TYPES) {
      return;
   }
   
   for (let i = 0; i < amount; i++) {
      const spawnPosition = player.position.copy();

      const spawnOffsetMagnitude = ENTITY_SPAWN_RANGE * (Math.random() + 1) / 2;
      const spawnOffsetDirection = 2 * Math.PI * Math.random();
      spawnPosition.x += spawnOffsetMagnitude * Math.sin(spawnOffsetDirection);
      spawnPosition.y += spawnOffsetMagnitude * Math.cos(spawnOffsetDirection);

      createEntity(spawnPosition, unguardedEntityType as IEntityType);
   }
}

export function registerCommand(command: string, player: Entity): void {
   const commandComponents = parseCommand(command);
   const numParameters = commandComponents.length - 1;

   switch (commandComponents[0]) {
      case "kill": {
         if (numParameters === 0) {
            killPlayer(player);
         } else if (numParameters === 1) {
            const targetPlayerName = commandComponents[1] as string;
            const player = SERVER.getPlayerFromUsername(targetPlayerName);
            if (player !== null) {
               killPlayer(player);
            }
         }

         break;
      }

      case "damage": {
         if (numParameters === 1) {
            const damage = commandComponents[1] as number;
            damagePlayer(player, damage);
         } else if (numParameters === 2) {
            const username = commandComponents[1] as string;
            const damage = commandComponents[2] as number;

            const player = SERVER.getPlayerFromUsername(username);
            if (player !== null) {
               damagePlayer(player, damage);
            }
         }

         break;
      }

      case "heal": {
         if (numParameters === 0) {
            healEntity(player, 99999);
         } else if (numParameters === 1) {
            const healing = commandComponents[1] as number;
            healEntity(player, healing);
         } else if (numParameters === 2) {
            const username = commandComponents[1] as string;
            const healing = commandComponents[2] as number;

            const player = SERVER.getPlayerFromUsername(username);
            if (player !== null) {
               healEntity(player, healing);
            }
         }

         break;
      }

      case "set_time": {
         setTime(commandComponents[1] as number);

         break;
      }

      case "give": {
         const itemType = commandComponents[1];

         if (!Object.keys(ItemType).includes(itemType.toString())) {
            break;
         }

         const confirmedItemType = ItemType[itemType as keyof typeof ItemType];

         if (numParameters === 1) {
            giveItem(player, confirmedItemType, 1);
         } else if (numParameters === 2) {
            const amount = commandComponents[2] as number;
            giveItem(player, confirmedItemType, amount);
         }
         
         break;
      }

      case "tp": {
         const x = commandComponents[1] as number;
         const y = commandComponents[2] as number;
         tp(player, x, y);
         break;
      }

      case "tpbiome": {
         const biomeName = commandComponents[1] as BiomeName;
         tpBiome(player, biomeName);
         break;
      }
      
      case "summon": {
         const unguardedEntityType = EntityType[commandComponents[1] as EntityType] as unknown as number;
         if (numParameters === 1) {
            summonEntities(player, unguardedEntityType, 1);
         } else {
            const amount = commandComponents[2] as number;
            summonEntities(player, unguardedEntityType, amount);
         }
         break;
      }
   }
}