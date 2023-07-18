import { Point, randItem, SETTINGS, Vector } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { SERVER } from "../server";
import Entity from "./Entity";
import Zombie from "./mobs/Zombie";

class Tombstone extends Entity {
   private static readonly MAX_HEALTH = 50;

   /** Average number of zombies that are created by the tombstone in a second */
   private static readonly ZOMBIE_SPAWN_RATE = 0.05;
   /** Distance the zombies spawn from the tombstone */
   private static readonly ZOMBIE_SPAWN_DISTANCE = 48;
   /** Maximum amount of zombies that can be spawned by one tombstone */
   private static readonly MAX_SPAWNED_ZOMBIES = 4;
   
   private readonly tombstoneType: number;

   private readonly zombieSpawnPositions: ReadonlyArray<Point>;

   /** Amount of spawned zombies that are alive currently */
   private currentSpawnedZombieCount = 0;
   
   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Tombstone.MAX_HEALTH, false)
      }, "tombstone");

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: 64,
            height: 64
         })
      ]);

      this.tombstoneType = Math.floor(Math.random() * 3);

      this.setIsStatic(true);
 
      this.rotation = Math.PI * 2 * Math.random();

      // Calculate the zombie spawn positions based off the tombstone's position and rotation
      const zombieSpawnPositions = new Array<Point>();
      for (let i = 0, angleFromTombstone = this.rotation; i < 4; i++, angleFromTombstone += Math.PI / 2) {
         const offset = new Vector(Tombstone.ZOMBIE_SPAWN_DISTANCE, angleFromTombstone).convertToPoint();
         const spawnPosition = this.position.copy();
         spawnPosition.add(offset);

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
         const crumbleChance = Math.exp(dayProgress * 12 - 6);
         if (Math.random() < crumbleChance / SETTINGS.TPS) {
            // Crumble
            this.remove();
            return;
         }
      }

      // Don't spawn zombies past the max spawn limit
      if (this.currentSpawnedZombieCount >= Tombstone.MAX_SPAWNED_ZOMBIES) return;

      if (Math.random() < Tombstone.ZOMBIE_SPAWN_RATE / SETTINGS.TPS) {
         // Note: tombstone type 0 is the golden tombstone
         const isGolden = this.tombstoneType === 0 && Math.random() < 0.001;
         
         // Spawn zombie
         // Copy the position to avoid having multiple zombies quantum entangled together
         const spawnPosition = randItem(this.zombieSpawnPositions).copy();
         const zombie = new Zombie(spawnPosition, isGolden);

         // Keep track of the zombie
         this.currentSpawnedZombieCount++;
         zombie.createEvent("death", () => this.currentSpawnedZombieCount--);
      }
   }

   public getClientArgs(): [tombstoneType: number] {
      return [this.tombstoneType];
   }
}

export default Tombstone;