import { ParticleType, Point, randFloat, randItem, SETTINGS, Vector } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Entity from "./Entity";
import Zombie from "./mobs/Zombie";
import Board from "../Board";
import Particle from "../Particle";

class Tombstone extends Entity {
   private static readonly MAX_HEALTH = 50;

   /** Average number of zombies that are created by the tombstone in a second */
   // private static readonly ZOMBIE_SPAWN_RATE = 0.05;
   private static readonly ZOMBIE_SPAWN_RATE = 1;
   /** Distance the zombies spawn from the tombstone */
   private static readonly ZOMBIE_SPAWN_DISTANCE = 48;
   /** Maximum amount of zombies that can be spawned by one tombstone */
   private static readonly MAX_SPAWNED_ZOMBIES = 4;
   /** Seconds it takes for a tombstone to spawn a zombie */
   private static readonly ZOMBIE_SPAWN_TIME = 1.5;
   
   private readonly tombstoneType: number;

   private readonly zombieSpawnPositions: ReadonlyArray<Point>;

   /** Amount of spawned zombies that are alive currently */
   private currentSpawnedZombieCount = 0;

   /** Whether or not the tombstone is spawning a zombie */
   private isSpawningZombie = false;
   private zombieSpawnTimer = 0;
   private zombieSpawnPosition!: Point;

   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(Tombstone.MAX_HEALTH, false)
      }, "tombstone", isNaturallySpawned);

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: 48,
            height: 88
         })
      ]);

      this.tombstoneType = Math.floor(Math.random() * 3);

      this.setIsStatic(true);
 
      this.rotation = Math.PI * 2 * Math.random();

      // Calculate the zombie spawn positions based off the tombstone's position and rotation
      const zombieSpawnPositions = new Array<Point>();
      for (let i = 0, angleFromTombstone = this.rotation; i < 4; i++, angleFromTombstone += Math.PI / 2) {
         const offset = new Vector(Tombstone.ZOMBIE_SPAWN_DISTANCE + (i % 2 === 0 ? 15 : 0), angleFromTombstone).convertToPoint();
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
         this.createDirtParticle();
         
         this.zombieSpawnTimer += 1 / SETTINGS.TPS;
         if (this.zombieSpawnTimer >= Tombstone.ZOMBIE_SPAWN_TIME) {
            this.spawnZombie();
         }
      }
   }

   private createDirtParticle(): void {
      const spawnPosition = this.zombieSpawnPosition.copy();
      
      new Particle({
         type: ParticleType.dirt,
         spawnPosition: spawnPosition,
         initialVelocity: new Vector(randFloat(120, 180), 2 * Math.PI * Math.random()),
         initialAcceleration: null,
         initialRotation: 2 * Math.PI * Math.random(),
         opacity: 1,
         drag: 300,
         lifetime: 1
      });
   }

   private spawnZombie(): void {
      // Note: tombstone type 0 is the golden tombstone
      const isGolden = this.tombstoneType === 0 && Math.random() < 0.001;
      
      // Spawn zombie
      // Copy the position to avoid having multiple zombies quantum entangled together
      const zombie = new Zombie(this.zombieSpawnPosition, false, isGolden);

      // Keep track of the zombie
      this.currentSpawnedZombieCount++;
      zombie.createEvent("death", () => this.currentSpawnedZombieCount--);

      this.isSpawningZombie = false;
   }

   public getClientArgs(): [tombstoneType: number] {
      return [this.tombstoneType];
   }
}

export default Tombstone;