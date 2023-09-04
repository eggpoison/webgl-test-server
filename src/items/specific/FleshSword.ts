import { Vector, ParticleType, lerp } from "webgl-test-shared";
import Particle from "../../Particle";
import Entity from "../../entities/Entity";
import SwordItem from "../generic/SwordItem";
import TexturedParticle from "../../TexturedParticle";

class FleshSword extends SwordItem {
   public damageEntity(entity: Entity): void {
   entity.applyStatusEffect("poisoned", 3);

      // Create slime puddle
      const spawnPosition = entity.position.copy();
      const offset = new Vector(30 * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
      spawnPosition.add(offset);

      const lifetime = 7.5;
      
      new TexturedParticle({
         type: ParticleType.slimePuddle,
         spawnPosition: spawnPosition,
         initialVelocity: null,
         initialAcceleration: null,
         initialRotation: 2 * Math.PI * Math.random(),
         opacity: (age: number): number => {
            return lerp(0.75, 0, age / lifetime);
         },
         lifetime: lifetime
      });
   }
}

export default FleshSword;