import { Point, randItem, SETTINGS, Vector } from "webgl-test-shared";
import { SERVER } from "../server";
import Entity from "./Entity";
import Zombie from "./Zombie";


class Tombstone extends Entity {
   /** Average number of zombies that are created by the tombstone in a second */
   private static readonly ZOMBIE_SPAWN_RATE = 0.1;
   /** Distance the zombies spawn from the tombstone */
   private static readonly ZOMBIE_SPAWN_DISTANCE = 48;
   
   private readonly tombstoneType: number;

   private readonly zombieSpawnPositions: ReadonlyArray<Point>;
   
   constructor(position: Point) {
      super(position, "tombstone", {});

      this.tombstoneType = Math.floor(Math.random() * 3);

      this.setIsStatic(true);
 
      this.rotation = Math.PI * 2 * Math.random();

      // Calculate the zombie spawn positions based off the tombstone's position and rotation
      const zombieSpawnPositions = new Array<Point>();
      for (let i = 0, angleFromTombstone = this.rotation; i < 4; i++, angleFromTombstone += Math.PI / 2) {
         const offset = new Vector(Tombstone.ZOMBIE_SPAWN_DISTANCE, angleFromTombstone).convertToPoint();
         const spawnPosition = this.position.add(offset);

         // Make sure the spawn position is valid
         if (spawnPosition.x < 0 || spawnPosition.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE || spawnPosition.y < 0 || spawnPosition.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) {
            continue;
         }

         zombieSpawnPositions.push(spawnPosition);
      }
      this.zombieSpawnPositions = zombieSpawnPositions;
   }

   public tick(): void {
      super.tick();

      // If in the daytime, chance to crumble
      if (SERVER.time > 6 && SERVER.time < 18) {
         const dayProgress = (SERVER.time - 6) / 12;
         const crumbleChance = Math.exp(dayProgress * 2);
         if (Math.random() < crumbleChance / SETTINGS.TPS) {
            // Crumble
            this.isRemoved = true;
            return;
         }
      }

      if (Math.random() < Tombstone.ZOMBIE_SPAWN_RATE / SETTINGS.TPS) {
         // Spawn zombie
         const spawnPosition = randItem(this.zombieSpawnPositions);
         new Zombie(spawnPosition);
      }
   }

   public getClientArgs(): [tombstoneType: number] {
      return [this.tombstoneType];
   }
}

export default Tombstone;