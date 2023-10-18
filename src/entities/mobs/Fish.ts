import { FishColour, ItemType, Point, SETTINGS, TileType } from "webgl-test-shared";
import Mob from "./Mob";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import WanderAI from "../../mob-ai/WanderAI";
import HerdAI from "../../mob-ai/HerdAI";
import FlailAI from "../../mob-ai/FlailAI";
import { MobAIType } from "../../mob-ai-types";
import Board from "../../Board";

const NUM_FISH_COLOURS = Object.keys(FishColour).length / 2;

class Fish extends Mob {
   private static readonly WIDTH = 7 * 4;
   private static readonly HEIGHT = 14 * 4;
   
   private static readonly MAX_HEALTH = 5;

   private static readonly ACCELERATION = 100;
   private static readonly TERMINAL_VELOCITY = 100;

   private readonly colour = Math.floor(Math.random() * NUM_FISH_COLOURS);

   public mass = 0.5;

   private timeOutOfWater = 0;
   
   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Fish.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent(20)
      }, "fish", 150);

      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.raw_fish, 1, false);

      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(Fish.WIDTH, Fish.HEIGHT);
      this.addHitbox(hitbox);

      this.addAI(new FlailAI(this, {
         flailForce: 200,
         flailIntervalSeconds: 0.75
      }));

      this.addAI(new HerdAI(this, {
         acceleration: Fish.ACCELERATION,
         terminalVelocity: Fish.TERMINAL_VELOCITY,
         minSeperationDistance: 150,
         turnRate: 0.5,
         minActivateAmount: 1,
         maxActivateAmount: 6,
         validHerdMembers: new Set(["fish"]),
         seperationInfluence: 0.7,
         alignmentInfluence: 0.5,
         cohesionInfluence: 0.3
      }));

      this.addAI(new WanderAI(this, {
         acceleration: Fish.ACCELERATION,
         terminalVelocity: Fish.TERMINAL_VELOCITY,
         wanderRate: 0.5,
         validTileTargets: [TileType.water]
      }));

      this.rotation = 2 * Math.PI * Math.random();
   }

   public tick(): void {
      super.tick();

      if (this.currentAI !== null && this.currentAI.type !== MobAIType.flail && this.currentAI.targetPosition !== null) {
         this.rotation = this.position.calculateAngleBetween(this.currentAI.targetPosition) + Math.sin(Board.ticks / 5) * 0.2;
      }

      if (this.tile.type !== TileType.water) {
         this.timeOutOfWater += 1 / SETTINGS.TPS;
         if (this.timeOutOfWater > 3 && )
      }
   }

   getClientArgs(): [colour: FishColour] {
      return [this.colour];
   }
}

export default Fish;