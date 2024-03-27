import { COLLISION_BITS, CactusBodyFlowerData, CactusComponentData, CactusLimbData, CactusLimbFlowerData, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, ItemType, PlayerCauseOfDeath, Point, lerp, randFloat, randInt } from "webgl-test-shared";
import Entity from "../../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { CactusComponentArray, HealthComponentArray } from "../../components/ComponentArray";
import { HealthComponent, addLocalInvulnerabilityHash, canDamageEntity, damageEntity } from "../../components/HealthComponent";
import { createItemsOverEntity } from "../../entity-shared";
import { CactusComponent } from "../../components/CactusComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { SERVER } from "../../server";
import { applyKnockback } from "../../components/PhysicsComponent";

const RADIUS = 40;
/** Amount the hitbox is brought in. */
const HITBOX_PADDING = 3;
const LIMB_PADDING = 10;

const generateRandomFlowers = (): ReadonlyArray<CactusBodyFlowerData> => {
   // Generate random number of flowers from 1 to 5, weighted low
   let numFlowers = 1;
   while (Math.random() < 0.35 && numFlowers < 5) {
      numFlowers++;
   }

   const flowers = new Array<CactusBodyFlowerData>();

   for (let i = 0; i < numFlowers; i++) {
      flowers.push({
         type: randInt(0, 4),
         column: randInt(0, 7),
         height: lerp(10, RADIUS - LIMB_PADDING, Math.random()),
         size: randInt(0, 1),
         rotation: 2 * Math.PI * Math.random()
      });
   }

   return flowers;
}

const generateRandomLimbs = (): ReadonlyArray<CactusLimbData> => {
   // Low chance for 0 limbs
   // High chance for 1 limb
   // Less chance for 2 limbs
   // Less chance for 3 limbs
   let numLimbs = 0;
   while (Math.random() < 4/5 - numLimbs/5 && numLimbs < 3) {
      numLimbs++;
   }

   const limbs = new Array<CactusLimbData>();

   for (let i = 0; i < numLimbs; i++) {
      let flower: CactusLimbFlowerData | undefined;

      if (Math.random() < 0.45) {
         flower = {
            type: randInt(0, 3),
            height: randFloat(6, 10),
            direction: 2 * Math.PI * Math.random(),
            rotation: 2 * Math.PI * Math.random()
         }
      }

      limbs.push({
         direction: 2 * Math.PI * Math.random(),
         flower: flower
      });
   }

   return limbs;
}

export function createCactus(position: Point): Entity {
   const cactus = new Entity(position, IEntityType.cactus, COLLISION_BITS.cactus, DEFAULT_COLLISION_MASK);
   cactus.rotation = 2 * Math.PI * Math.random();

   const hitbox = new CircularHitbox(cactus.position.x, cactus.position.y, 1, 0, 0, HitboxCollisionTypeConst.soft, RADIUS - HITBOX_PADDING, cactus.getNextHitboxLocalID(), cactus.rotation);
   cactus.addHitbox(hitbox);

   const flowers = generateRandomFlowers();
   const limbs = generateRandomLimbs();

   // Create hitboxes for all the cactus limbs
   for (let i = 0; i < limbs.length; i++) {
      const limb = limbs[i]
      const hitbox = new CircularHitbox(cactus.position.x, cactus.position.y, 0.4, 37 * Math.sin(limb.direction), 37 * Math.cos(limb.direction), HitboxCollisionTypeConst.soft, 18, cactus.getNextHitboxLocalID(), cactus.rotation);
      cactus.addHitbox(hitbox);
   }

   HealthComponentArray.addComponent(cactus, new HealthComponent(15));
   StatusEffectComponentArray.addComponent(cactus, new StatusEffectComponent(0));
   CactusComponentArray.addComponent(cactus, new CactusComponent(flowers, limbs));
   
   return cactus;
}

export function onCactusCollision(cactus: Entity, collidingEntity: Entity): void {
   if (collidingEntity.type === IEntityType.itemEntity) {
      collidingEntity.remove();
      return;
   }
   
   if (!HealthComponentArray.hasComponent(collidingEntity)) {
      return;
   }

   const healthComponent = HealthComponentArray.getComponent(collidingEntity.id);
   if (!canDamageEntity(healthComponent, "cactus")) {
      return;
   }

   const hitDirection = cactus.position.calculateAngleBetween(collidingEntity.position);

   damageEntity(collidingEntity, 1, cactus, PlayerCauseOfDeath.cactus, "cactus");
   applyKnockback(collidingEntity, 200, hitDirection);
   SERVER.registerEntityHit({
      entityPositionX: collidingEntity.position.x,
      entityPositionY: collidingEntity.position.y,
      hitEntityID: collidingEntity.id,
      damage: 1,
      knockback: 200,
      angleFromAttacker: hitDirection,
      attackerID: cactus.id,
      flags: 0
   });
   addLocalInvulnerabilityHash(healthComponent, "cactus", 0.3);
}

export function onCactusDeath(cactus: Entity): void {
   createItemsOverEntity(cactus, ItemType.cactus_spine, randInt(2, 5), 40);
}

export function onCactusRemove(cactus: Entity): void {
   HealthComponentArray.removeComponent(cactus);
   StatusEffectComponentArray.removeComponent(cactus);
   CactusComponentArray.removeComponent(cactus);
}

export function serialiseCactusComponent(cactus: Entity): CactusComponentData {
   const cactusComponent = CactusComponentArray.getComponent(cactus.id);
   return {
      flowers: cactusComponent.flowers,
      limbs: cactusComponent.limbs
   };
}