import { ItemType, Point, SETTINGS, randInt } from "webgl-test-shared";
import Mob from "./Mob";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import EscapeAI from "../../mob-ai/EscapeAI";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import WanderAI from "../../mob-ai/WanderAI";
import FollowAI from "../../mob-ai/FollowAI";

class Krumblid extends Mob {
   private static readonly SIZE = 48;
   
   private static readonly MAX_HEALTH = 15;

   private static readonly WALK_ACCELERATION = 400;
   private static readonly WALK_TERMINAL_VELOCITY = 100;
   private static readonly RUN_ACCELERATION = 700;
   private static readonly RUN_TERMINAL_VELOCITY = 200;

   public mass = 0.75;
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(Krumblid.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "krumblid", SETTINGS.TILE_SIZE * 3.5, isNaturallySpawned);

      this.getComponent("item_creation")!.createItemOnDeath(ItemType.leather, randInt(2, 3), true);

      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(Krumblid.SIZE / 2);
      this.addHitbox(hitbox);

      // Make the krumblid like to hide in cacti
      this.addAI(new FollowAI(this, {
         aiWeightMultiplier: 1,
         acceleration: Krumblid.WALK_ACCELERATION,
         terminalVelocity: Krumblid.WALK_TERMINAL_VELOCITY,
         followableEntityTypes: new Set(["cactus"]),
         minDistanceFromFollowTarget: 40,
         weightBuildupTime: 9 + Math.random(),
         interestDuration: 3 + Math.random()
      }));

      this.addAI(new WanderAI(this, {
         aiWeightMultiplier: 0.5,
         acceleration: Krumblid.WALK_ACCELERATION,
         terminalVelocity: Krumblid.WALK_TERMINAL_VELOCITY,
         wanderRate: 0.25,
         validTileTargets: new Set(["sand"])
      }));

      this.addAI(new EscapeAI(this, {
         aiWeightMultiplier: 1.5,
         acceleration: Krumblid.RUN_ACCELERATION,
         terminalVelocity: Krumblid.RUN_TERMINAL_VELOCITY,
         attackSubsideTime: 3,
         escapeHealthThreshold: Krumblid.MAX_HEALTH
      }));

      this.rotation = 2 * Math.PI * Math.random();
   }
   
   public getClientArgs(): [] {
      return [];
   }
}

export default Krumblid;