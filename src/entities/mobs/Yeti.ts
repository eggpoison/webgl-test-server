import { Point, randInt, SETTINGS, TileType } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import Mob from "./Mob";
import Entity from "../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import _GameObject from "../../GameObject";

class Yeti extends Mob {
   private static readonly MAX_HEALTH = 100;

   private static readonly SIZE = 128;

   private static readonly CONTACT_DAMAGE = 3;
   private static readonly CONTACT_KNOCKBACK = 200;

   private static readonly YETI_TILES: ReadonlySet<TileType> = new Set(["snow", "ice", "permafrost"]);

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Yeti.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "yeti", SETTINGS.TILE_SIZE * 7, true);

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Yeti.SIZE / 2
         })
      ]);

      this.addAI("wander", {
         aiWeightMultiplier: 0.5,
         wanderRate: 0.6,
         acceleration: 100,
         terminalVelocity: 50,
         validTileTargets: Yeti.YETI_TILES
      });

      this.addAI("chase", {
         aiWeightMultiplier: 1,
         acceleration: 200,
         terminalVelocity: 100,
         entityIsChased(entity: Entity) {
            // Don't try to attack ice spikes
            if (entity.type === "ice_spikes") return false;
            
            // Chase the entity if they are standing on snow
            return Yeti.YETI_TILES.has(entity.tile.type);
         }
      });

      this.addAI("itemConsume", {
         aiWeightMultiplier: 0.8,
         acceleration: 100,
         terminalVelocity: 50,
         metabolism: 1,
         itemTargets: new Set(["raw_beef", "leather"])
      });

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         // Don't damage ice spikes
         if (collidingEntity.type === "ice_spikes") return;
         
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(Yeti.CONTACT_DAMAGE, Yeti.CONTACT_KNOCKBACK, hitDirection, this, "yeti");
            healthComponent.addLocalInvulnerabilityHash("yeti", 0.3);
         }
      });

      this.rotation = 2 * Math.PI * Math.random();

      this.getComponent("item_creation")!.createItemOnDeath("raw_beef", randInt(4, 7));
      this.getComponent("item_creation")!.createItemOnDeath("yeti_hide", randInt(2, 3));
   }

   public getClientArgs(): [] {
      return [];
   }
}

export default Yeti;