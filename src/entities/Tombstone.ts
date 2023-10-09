import { DeathInfo, Point, randItem, SETTINGS, Vector } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Entity from "./Entity";
import Zombie from "./mobs/Zombie";
import Board from "../Board";
import TombstoneDeathManager from "../tombstone-deaths";

class Tombstone extends Entity {
   private static readonly MAX_HEALTH = 50;

   private static readonly WIDTH = 48;
   private static readonly HEIGHT = 88;
   
   /** Average number of zombies that are created by the tombstone in a second */
   private static readonly ZOMBIE_SPAWN_RATE = 0.05;
   /** Distance the zombies spawn from the tombstone */
   private static readonly ZOMBIE_SPAWN_DISTANCE = 48;
   /** Maximum amount of zombies that can be spawned by one tombstone */
   private static readonly MAX_SPAWNED_ZOMBIES = 4;
   /** Seconds it takes for a tombstone to spawn a zombie */
   private static readonly ZOMBIE_SPAWN_TIME = 3;
   
   private readonly tombstoneType: number;

   private readonly zombieSpawnPositions: ReadonlyArray<Point>;

   /** Amount of spawned zombies that are alive currently */
   private currentSpawnedZombieCount = 0;

   /** Whether or not the tombstone is spawning a zombie */
   private isSpawningZombie = false;
   private zombieSpawnTimer = 0;
   private zombieSpawnPosition!: Point;

   private readonly deathInfo: DeathInfo | null;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Tombstone.MAX_HEALTH, false)
      }, "tombstone");

      this.deathInfo = TombstoneDeathManager.popDeath();

      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(Tombstone.WIDTH, Tombstone.HEIGHT);
      this.addHitbox(hitbox);

      this.tombstoneType = Math.floor(Math.random() * 3);

      this.isStatic = true;
 
      this.rotation = Math.PI * 2 * Math.random();

      // Calculate the zombie spawn positions based off the tombstone's position and rotation
      const zombieSpawnPositions = new Array<Point>();
      for (let i = 0, angleFromTombstone = this.rotation; i < 4; i++, angleFromTombstone += Math.PI / 2) {
         const offset = Point.fromVectorForm(Tombstone.ZOMBIE_SPAWN_DISTANCE + (i % 2 === 0 ? 15 : 0), angleFromTombstone);
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
      if (Board.time > 6 && Board.time < 18) {
         const dayProgress = (Board.time - 6) / 12;
         const crumbleChance = Math.exp(dayProgress * 12 - 6);
         if (Math.random() < crumbleChance / SETTINGS.TPS) {
            // Crumble
            this.remove();
            return;
         }
      }

      // Don't spawn zombies past the max spawn limit
      if (this.currentSpawnedZombieCount < Tombstone.MAX_SPAWNED_ZOMBIES && !this.isSpawningZombie) {
         if (Math.random() < Tombstone.ZOMBIE_SPAWN_RATE / SETTINGS.TPS) {
            // Start spawning a zombie
            this.isSpawningZombie = true;
            this.zombieSpawnTimer = 0;
            this.zombieSpawnPosition = randItem(this.zombieSpawnPositions).copy();
         }
      }

      if (this.isSpawningZombie) {
         this.zombieSpawnTimer += 1 / SETTINGS.TPS;
         if (this.zombieSpawnTimer >= Tombstone.ZOMBIE_SPAWN_TIME) {
            this.spawnZombie();
         }
      }
   }

   private spawnZombie(): void {
      // Note: tombstone type 0 is the golden tombstone
      const isGolden = this.tombstoneType === 0 && Math.random() < 0.001;
      
      // Spawn zombie
      // Copy the position to avoid having multiple zombies quantum entangled together
      const zombie = new Zombie(this.zombieSpawnPosition, isGolden);

      // Keep track of the zombie
      this.currentSpawnedZombieCount++;
      zombie.createEvent("death", () => this.currentSpawnedZombieCount--);

      this.isSpawningZombie = false;
   }

   public getClientArgs(): [tombstoneType: number, zombieSpawnProgress: number, zombieSpawnX: number, zombieSpawnY: number, deathInfo: DeathInfo | null] {
      return [
         this.tombstoneType,
         this.isSpawningZombie ? this.zombieSpawnTimer / Tombstone.ZOMBIE_SPAWN_TIME : -1,
         this.isSpawningZombie ? this.zombieSpawnPosition.x : -1,
         this.isSpawningZombie ? this.zombieSpawnPosition.y : -1,
         this.deathInfo
      ];
   }
}

export default Tombstone;