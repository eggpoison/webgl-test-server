import { COLLISION_BITS, DeathInfo, DEFAULT_COLLISION_MASK, EntityTypeConst, ItemType, Point, randInt, randItem, SETTINGS, Vector } from "webgl-test-shared";
// import HealthComponent from "../entity-components/OldHealthComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
// import Entity from "./Entity";
// import Zombie from "./mobs/OldZombie";
import Board from "../Board";
import TombstoneDeathManager from "../tombstone-deaths";
// import ItemCreationComponent from "../entity-components/ItemCreationComponent";

// class Tombstone extends Entity {
//    private static readonly MAX_HEALTH = 50;

//    private static readonly WIDTH = 48;
//    private static readonly HEIGHT = 88;
   
//    /** Average number of zombies that are created by the tombstone in a second */
//    private static readonly ZOMBIE_SPAWN_RATE = 0.05;
//    /** Distance the zombies spawn from the tombstone */
//    private static readonly ZOMBIE_SPAWN_DISTANCE = 48;
//    /** Maximum amount of zombies that can be spawned by one tombstone */
//    private static readonly MAX_SPAWNED_ZOMBIES = 4;
//    /** Seconds it takes for a tombstone to spawn a zombie */
//    private static readonly ZOMBIE_SPAWN_TIME = 3;
   
//    private readonly tombstoneType: number;

//    private readonly zombieSpawnPositions: ReadonlyArray<Point>;

//    /** Amount of spawned zombies that are alive currently */
//    private currentSpawnedZombieCount = 0;

//    /** Whether or not the tombstone is spawning a zombie */
//    private isSpawningZombie = false;
//    private zombieSpawnTimer = 0;
//    private zombieSpawnPosition!: Point;

//    private readonly deathInfo: DeathInfo | null;

//    public readonly collisionBit = COLLISION_BITS.other;
//    public readonly collisionMask = DEFAULT_COLLISION_MASK;

//    constructor(position: Point) {
//       super(position, {
//          health: new HealthComponent(Tombstone.MAX_HEALTH, false),
//          item_creation: new ItemCreationComponent(40)
//       }, EntityTypeConst.tombstone);

//       this.deathInfo = TombstoneDeathManager.popDeath();

//       const hitbox = new RectangularHitbox(this, 0, 0, Tombstone.WIDTH, Tombstone.HEIGHT);
//       this.addHitbox(hitbox);

//       this.tombstoneType = Math.floor(Math.random() * 3);

//       this.isStatic = true;
 
//       this.rotation = Math.PI * 2 * Math.random();

//       this.forceGetComponent("item_creation").createItemOnDeath(ItemType.rock, randInt(2, 3), true);

//       // Calculate the zombie spawn positions based off the tombstone's position and rotation
//       const zombieSpawnPositions = new Array<Point>();
//       for (let i = 0, angleFromTombstone = this.rotation; i < 4; i++, angleFromTombstone += Math.PI / 2) {
//          const offsetMagnitude = Tombstone.ZOMBIE_SPAWN_DISTANCE + (i % 2 === 0 ? 15 : 0);
//          const x = this.position.x + offsetMagnitude * Math.sin(angleFromTombstone);
//          const y = this.position.y + offsetMagnitude * Math.cos(angleFromTombstone);

//          // Make sure the spawn position is valid
//          if (x < 0 || x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE || y < 0 || y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) {
//             continue;
//          }

//          zombieSpawnPositions.push(new Point(x, y));
//       }
//       this.zombieSpawnPositions = zombieSpawnPositions;

//       this.createEvent("death", () => {
//          this.zombieSpawnPosition = this.position.copy();
//          this.spawnZombie();
//       });
//    }

//    public tick(): void {
//       super.tick();

//       // If in the daytime, chance to crumble
//       if (Board.time > 6 && Board.time < 18) {
//          const dayProgress = (Board.time - 6) / 12;
//          const crumbleChance = Math.exp(dayProgress * 12 - 6);
//          if (Math.random() < crumbleChance / SETTINGS.TPS) {
//             // Crumble
//             this.remove();
//             return;
//          }
//       }

//       // Don't spawn zombies past the max spawn limit
//       if (this.currentSpawnedZombieCount < Tombstone.MAX_SPAWNED_ZOMBIES && !this.isSpawningZombie) {
//          if (Math.random() < Tombstone.ZOMBIE_SPAWN_RATE / SETTINGS.TPS) {
//             // Start spawning a zombie
//             this.isSpawningZombie = true;
//             this.zombieSpawnTimer = 0;
//             this.zombieSpawnPosition = randItem(this.zombieSpawnPositions).copy();
//          }
//       }

//       if (this.isSpawningZombie) {
//          this.zombieSpawnTimer += 1 / SETTINGS.TPS;
//          if (this.zombieSpawnTimer >= Tombstone.ZOMBIE_SPAWN_TIME) {
//             this.spawnZombie();
//          }
//       }
//    }

//    private spawnZombie(): void {
//       // Note: tombstone type 0 is the golden tombstone
//       const isGolden = this.tombstoneType === 0 && Math.random() < 0.005;
      
//       // Spawn zombie
//       // Copy the position to avoid having multiple zombies quantum entangled together
//       const zombie = new Zombie(this.zombieSpawnPosition, isGolden);

//       // Keep track of the zombie
//       this.currentSpawnedZombieCount++;
//       zombie.createEvent("death", () => this.currentSpawnedZombieCount--);

//       this.isSpawningZombie = false;
//    }

//    public getClientArgs(): [tombstoneType: number, zombieSpawnProgress: number, zombieSpawnX: number, zombieSpawnY: number, deathInfo: DeathInfo | null] {
//       return [
//          this.tombstoneType,
//          this.isSpawningZombie ? this.zombieSpawnTimer / Tombstone.ZOMBIE_SPAWN_TIME : -1,
//          this.isSpawningZombie ? this.zombieSpawnPosition.x : -1,
//          this.isSpawningZombie ? this.zombieSpawnPosition.y : -1,
//          this.deathInfo
//       ];
//    }
// }

// export default Tombstone;