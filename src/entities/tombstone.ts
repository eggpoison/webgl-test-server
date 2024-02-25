import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, ItemType, Point, SettingsConst, StatusEffectConst, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { HealthComponentArray, TombstoneComponentArray } from "../components/ComponentArray";
import { HealthComponent } from "../components/HealthComponent";
import { createItemsOverEntity } from "../entity-shared";
import Board from "../Board";
import { TombstoneComponent } from "../components/TombstoneComponent";
import { createZombie } from "./mobs/zombie";
import TombstoneDeathManager from "../tombstone-deaths";
import { StatusEffectComponent, StatusEffectComponentArray } from "../components/StatusEffectComponent";

const WIDTH = 48;
const HEIGHT = 88;

const MAX_HEALTH = 50;
   
/** Average number of zombies that are created by the tombstone in a second */
const ZOMBIE_SPAWN_RATE = 0.05;
/** Distance the zombies spawn from the tombstone */
const ZOMBIE_SPAWN_DISTANCE = 48;
/** Maximum amount of zombies that can be spawned by one tombstone */
const MAX_SPAWNED_ZOMBIES = 4;
/** Seconds it takes for a tombstone to spawn a zombie */
const ZOMBIE_SPAWN_TIME = 3;

export function createTombstone(position: Point): Entity {
   const tombstone = new Entity(position, IEntityType.tombstone, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   tombstone.rotation = 2 * Math.PI * Math.random();

   const hitbox = new RectangularHitbox(tombstone, 1.25, 0, 0, WIDTH, HEIGHT);
   tombstone.addHitbox(hitbox);

   HealthComponentArray.addComponent(tombstone, new HealthComponent(MAX_HEALTH));
   StatusEffectComponentArray.addComponent(tombstone, new StatusEffectComponent(StatusEffectConst.poisoned));
   TombstoneComponentArray.addComponent(tombstone, new TombstoneComponent(randInt(0, 2), TombstoneDeathManager.popDeath()));
   
   return tombstone;
}

const generateZombieSpawnPosition = (tombstone: Entity): Point => {
   const seenIs = new Array<number>();
   while (true) {
      let i: number;
      do {
         i = randInt(0, 3);
      } while (seenIs.includes(i));

      const angleFromTombstone = i * Math.PI / 2;

      const offsetMagnitude = ZOMBIE_SPAWN_DISTANCE + (i % 2 === 0 ? 15 : 0);
      const x = tombstone.position.x + offsetMagnitude * Math.sin(angleFromTombstone);
      const y = tombstone.position.y + offsetMagnitude * Math.cos(angleFromTombstone);
   
      // Make sure the spawn position is valid
      if (x < 0 || x >= SettingsConst.BOARD_UNITS || y < 0 || y >= SettingsConst.BOARD_UNITS) {
         seenIs.push(i);
         if (seenIs.length === 4) {
            return new Point(-1, -1);
         }
      } else {
         return new Point(x, y);
      }
   }
}

const spawnZombie = (tombstone: Entity, tombstoneComponent: TombstoneComponent): void => {
   // Note: tombstone type 0 is the golden tombstone
   const isGolden = tombstoneComponent.tombstoneType === 0 && Math.random() < 0.005;
   
   // Spawn zombie
   const spawnPosition = new Point(tombstoneComponent.zombieSpawnPositionX, tombstoneComponent.zombieSpawnPositionY);
   createZombie(spawnPosition, isGolden, tombstone.id);

   tombstoneComponent.numZombies++;
   tombstoneComponent.isSpawningZombie = false;
}

export function tickTombstone(tombstone: Entity): void {
   // If in the daytime, chance to crumble
   if (Board.time > 6 && Board.time < 18) {
      const dayProgress = (Board.time - 6) / 12;
      const crumbleChance = Math.exp(dayProgress * 12 - 6);
      if (Math.random() < crumbleChance * SettingsConst.I_TPS) {
         // Crumble
         tombstone.remove();
         return;
      }
   }

   const tombstoneComponent = TombstoneComponentArray.getComponent(tombstone.id);

   // Start zombie spawn
   if (tombstoneComponent.numZombies < MAX_SPAWNED_ZOMBIES && !tombstoneComponent.isSpawningZombie) {
      if (Math.random() < ZOMBIE_SPAWN_RATE * SettingsConst.I_TPS) {
         // Start spawning a zombie
         tombstoneComponent.isSpawningZombie = true;
         tombstoneComponent.zombieSpawnTimer = 0;

         const zombieSpawnPosition = generateZombieSpawnPosition(tombstone);
         tombstoneComponent.zombieSpawnPositionX = zombieSpawnPosition.x;
         tombstoneComponent.zombieSpawnPositionY = zombieSpawnPosition.y;
      }
   }

   // Spawn zombies
   if (tombstoneComponent.isSpawningZombie) {
      tombstoneComponent.zombieSpawnTimer += SettingsConst.I_TPS;
      if (tombstoneComponent.zombieSpawnTimer >= ZOMBIE_SPAWN_TIME) {
         spawnZombie(tombstone, tombstoneComponent);
      }
   }
}

export function onTombstoneDeath(tombstone: Entity, attackingEntity: Entity | null): void {
   if (attackingEntity !== null) {
      createItemsOverEntity(tombstone, ItemType.rock, randInt(2, 3));

      createZombie(tombstone.position.copy(), false, tombstone.id);
   }
}

export function onTombstoneRemove(tombstone: Entity): void {
   HealthComponentArray.removeComponent(tombstone);
   StatusEffectComponentArray.removeComponent(tombstone);
   TombstoneComponentArray.removeComponent(tombstone);
}

export function getZombieSpawnProgress(tombstoneComponent: TombstoneComponent): number {
   return tombstoneComponent.isSpawningZombie ? tombstoneComponent.zombieSpawnTimer / ZOMBIE_SPAWN_TIME : -1;
}