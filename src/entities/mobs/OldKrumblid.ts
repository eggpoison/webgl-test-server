import { COLLISION_BITS, DEFAULT_COLLISION_MASK, ItemType, Point, SETTINGS, TileType, TileTypeConst, randInt } from "webgl-test-shared";
// import Mob from "./Mob";
// import HealthComponent from "../../entity-components/OldHealthComponent";
// import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
// import EscapeAI from "../../mob-ai/EscapeAI";
import CircularHitbox from "../../hitboxes/CircularHitbox";
// import WanderAI from "../../mob-ai/WanderAI";
// import FollowAI from "../../mob-ai/FollowAI";

// class Krumblid extends Mob {
//    private static readonly SIZE = 48;
   
//    private static readonly MAX_HEALTH = 15;

//    private static readonly WALK_ACCELERATION = 400;
//    private static readonly WALK_TERMINAL_VELOCITY = 100;
//    private static readonly RUN_ACCELERATION = 700;
//    private static readonly RUN_TERMINAL_VELOCITY = 200;

//    public mass = 0.75;

//    public readonly collisionBit = COLLISION_BITS.other;
//    public readonly collisionMask = DEFAULT_COLLISION_MASK & ~COLLISION_BITS.cactus;
   
//    constructor(position: Point) {
//       super(position, {
//          health: new HealthComponent(Krumblid.MAX_HEALTH, false),
//          item_creation: new ItemCreationComponent(48)
//       }, EntityTypeConst.krumblid, SETTINGS.TILE_SIZE * 3.5);

//       this.rotation = 2 * Math.PI * Math.random();

//       this.forceGetComponent("item_creation").createItemOnDeath(ItemType.leather, randInt(2, 3), true);

//       const hitbox = new CircularHitbox(this, 0, 0, Krumblid.SIZE / 2);
//       this.addHitbox(hitbox);

//       this.addAI(new EscapeAI(this, {
//          acceleration: Krumblid.RUN_ACCELERATION,
//          terminalVelocity: Krumblid.RUN_TERMINAL_VELOCITY,
//          attackSubsideTime: 3,
//          escapeHealthThreshold: Krumblid.MAX_HEALTH
//       }));

//       // Make the krumblid like to hide in cacti
//       this.addAI(new FollowAI(this, {
//          acceleration: Krumblid.WALK_ACCELERATION,
//          terminalVelocity: Krumblid.WALK_TERMINAL_VELOCITY,
//          followableEntityTypes: new Set([EntityTypeConst.cactus]),
//          minDistanceFromFollowTarget: 40,
//          weightBuildupTime: 9 + Math.random(),
//          interestDuration: 3 + Math.random()
//       }));

//       this.addAI(new WanderAI(this, {
//          acceleration: Krumblid.WALK_ACCELERATION,
//          terminalVelocity: Krumblid.WALK_TERMINAL_VELOCITY,
//          wanderRate: 0.25,
//          validTileTargets: [TileTypeConst.sand],
//          strictValidation: false,
//          tileValidationPadding: 0
//       }));
//    }
   
//    public getClientArgs(): [] {
//       return [];
//    }
// }

// export default Krumblid;