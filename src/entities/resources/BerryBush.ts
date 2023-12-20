import { COLLISION_BITS, DEFAULT_COLLISION_MASK, ItemType, Point, SETTINGS, Vector } from "webgl-test-shared";
// import Entity from "../Entity";
// import HealthComponent from "../../entity-components/OldHealthComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
// import DroppedItem from "../../items/DroppedItem";
import Board from "../../Board";
import Item from "../../items/Item";

// class BerryBush extends Entity {
//    private static readonly HEALTH = 10;

//    private static readonly RADIUS = 40;

//    private static readonly BERRY_DROP_OFFSET = 40;
//    private static readonly BERRY_DROP_VELOCITY = 40;

//    /** Number of seconds it takes for a berry bush to regrow one of its berries */
//    private static readonly BERRY_GROW_TIME = 30;

//    private numBerries = 5;

//    private berryGrowTimer = 0;

//    public readonly collisionBit = COLLISION_BITS.other;
//    public readonly collisionMask = DEFAULT_COLLISION_MASK;

//    constructor(position: Point) {
//       super(position, {
//          health: new HealthComponent(BerryBush.HEALTH, false)
//       }, EntityTypeConst.berry_bush);
      
//       this.rotation = 2 * Math.PI * Math.random();

//       const hitbox = new CircularHitbox(this, 0, 0, BerryBush.RADIUS);
//       this.addHitbox(hitbox);

//       this.createEvent("hurt", () => {
//          // Reset berry growth
//          this.berryGrowTimer = 0;

//          if (this.numBerries > 0) {
//             this.dropBerry();
//          }
//       });

//       this.isStatic = true;
//    }

//    public tick(): void {
//       super.tick();

//       if (this.numBerries < 5) {
//          this.berryGrowTimer += 1 / SETTINGS.TPS;
//          if (this.berryGrowTimer >= BerryBush.BERRY_GROW_TIME) {
//             this.berryGrowTimer = 0;
//             this.growBerry();
//          }
//       }
//    }

//    public getNumBerries(): number {
//       return this.numBerries;
//    }

//    public shake(): void {
//       if (this.numBerries > 0) {
//          this.dropBerry();
//       }
//    }

//    public getClientArgs(): [numBerries: number] {
//       return [this.numBerries];
//    }

//    private growBerry(): void {
//       this.numBerries++;
//    }

//    private dropBerry(): void {
//       this.numBerries--;

//       const berry = new Item(ItemType.berry, 1);

//       // Generate new spawn positions until we find one inside the board
//       let position: Point;
//       let spawnDirection: number;
//       do {
//          position = this.position.copy();

//          spawnDirection = 2 * Math.PI * Math.random();
//          const spawnOffset = new Vector(BerryBush.BERRY_DROP_OFFSET, spawnDirection).convertToPoint();

//          position.add(spawnOffset);
//       } while (!Board.isInBoard(position));

//       const droppedItem = new DroppedItem(position, berry);
      
//       const velocityDirectionOffset = (Math.random() - 0.5) * Math.PI * 0.15
//       droppedItem.velocity.x = BerryBush.BERRY_DROP_VELOCITY * Math.sin(spawnDirection + velocityDirectionOffset);
//       droppedItem.velocity.y = BerryBush.BERRY_DROP_VELOCITY * Math.cos(spawnDirection + velocityDirectionOffset);
//    }
// }

// export default BerryBush;