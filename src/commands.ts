import { BiomeName, EntityType, ItemType, PlayerCauseOfDeath, Point, SETTINGS, Vector, parseCommand, randItem } from "webgl-test-shared";
import Player from "./entities/tribes/Player";
import { SERVER } from "./server";
import { getTilesOfBiome } from "./census";
import Board from "./Board";
import ENTITY_CLASS_RECORD from "./entity-classes";
import Item from "./items/Item";

const ENTITY_SPAWN_RANGE = 200;

const killPlayer = (username: string): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   // Kill the player
   player.getComponent("health")!.damage(999999, 0, null, null, PlayerCauseOfDeath.god, 0);
}

const damagePlayer = (username: string, damage: number): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   // Damage the player
   player.getComponent("health")!.damage(damage, 0, null, null, PlayerCauseOfDeath.god, 0);
}

const healPlayer = (username: string, healing: number): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   // Damage the player
   player.getComponent("health")!.heal(healing);
}

const setTime = (time: number): void => {
   Board.time = time;
}

const giveItem = (username: string, itemType: ItemType, amount: number): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   if (amount === 0) {
      return;
   }

   const item = new Item(itemType, amount);
   player.getComponent("inventory")!.addItem(item);
}

const tp = (username: string, x: number, y: number): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   const newPosition = new Point(x, y);
   SERVER.sendForcePositionUpdatePacket(username, newPosition);
}

const tpBiome = (username: string, biomeName: BiomeName): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   const potentialTiles = getTilesOfBiome(biomeName);
   if (potentialTiles.length === 0) {
      console.warn(`No available tiles of biome '${biomeName}' to teleport to.`);
      return;
   }
   
   const tile = randItem(potentialTiles);
   const x = (tile.x + Math.random()) * SETTINGS.TILE_SIZE;
   const y = (tile.y + Math.random()) * SETTINGS.TILE_SIZE;

   const newPosition = new Point(x, y);
   SERVER.sendForcePositionUpdatePacket(username, newPosition);
}

const summonEntities = (username: string, unguardedEntityType: string, amount: number): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   if (!ENTITY_CLASS_RECORD.hasOwnProperty(unguardedEntityType)) {
      return;
   }

   const entityType = unguardedEntityType as EntityType;
   const entityClass = ENTITY_CLASS_RECORD[entityType]();
   
   for (let i = 0; i < amount; i++) {
      const spawnPosition = player.position.copy();
      const offset = new Vector(ENTITY_SPAWN_RANGE * (Math.random() + 1) / 2, 2 * Math.PI * Math.random()).convertToPoint();
      spawnPosition.add(offset);

      new entityClass(spawnPosition, false);
   }
}

export function registerCommand(command: string, player: Player): void {
   const commandComponents = parseCommand(command);
   const numParameters = commandComponents.length - 1;

   switch (commandComponents[0]) {
      case "kill": {
         if (numParameters === 0) {
            killPlayer(player.username);
         } else if (numParameters === 1) {
            const targetPlayerName = commandComponents[1] as string;
            killPlayer(targetPlayerName);
         }

         break;
      }

      case "damage": {
         if (numParameters === 1) {
            const damage = commandComponents[1] as number;
            damagePlayer(player.username, damage);
         } else if (numParameters === 2) {
            const username = commandComponents[1] as string;
            const damage = commandComponents[2] as number;
            damagePlayer(username, damage);
         }

         break;
      }

      case "heal": {
         if (numParameters === 0) {
            healPlayer(player.username, 99999);
         } else if (numParameters === 1) {
            const healing = commandComponents[1] as number;
            healPlayer(player.username, healing);
         } else if (numParameters === 2) {
            const username = commandComponents[1] as string;
            const healing = commandComponents[2] as number;
            healPlayer(username, healing);
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
            giveItem(player.username, confirmedItemType, 1);
         } else if (numParameters === 2) {
            const amount = commandComponents[2] as number;
            giveItem(player.username, confirmedItemType, amount);
         }
         
         break;
      }

      case "tp": {
         const x = commandComponents[1] as number;
         const y = commandComponents[2] as number;
         tp(player.username, x, y);
         break;
      }

      case "tpbiome": {
         const biomeName = commandComponents[1] as BiomeName;
         tpBiome(player.username, biomeName);
         break;
      }
      
      case "summon": {
         const unguardedEntityType = commandComponents[1] as string;
         if (numParameters === 1) {
            summonEntities(player.username, unguardedEntityType, 1);
         } else {
            const amount = commandComponents[2] as number;
            summonEntities(player.username, unguardedEntityType, amount);
         }
         break;
      }
   }
}