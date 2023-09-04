import { ParticleTint, ParticleType, Point, TexturedParticleData, Vector } from "webgl-test-shared";
import Particle, { ParticleInfo } from "./Particle";


export interface TexturedParticleInfo extends ParticleInfo {
   readonly type: ParticleType;
   readonly spawnPosition: Point;
   readonly initialVelocity: Vector | null;
   readonly initialAcceleration: Vector | null;
   readonly initialRotation: number;
   readonly angularVelocity?: number;
   readonly angularAcceleration?: number;
   readonly angularDrag?: number;
   readonly opacity: number | ((age: number) => number);
   readonly scale?: number | ((age: number) => number);
   /** Amount the particle's velocity gets decreased each second */
   readonly drag?: number;
   /** Number of seconds the particle lasts before being destroyed */
   readonly lifetime: number;
   readonly tint?: ParticleTint;
}

class TexturedParticle extends Particle {
   /** Each element indicates the modifier for the texture's colour from -1->1, where 0 doesn't affect the colour */
   public tint: ParticleTint = [0, 0, 0];

   constructor(info: TexturedParticleInfo) {
      super(info);
      
      this.tint = info.tint || [0, 0, 0];
   }
}

export default TexturedParticle;