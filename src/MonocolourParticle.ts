import { ParticleColour } from "webgl-test-shared";
import Particle, { ParticleInfo } from "./Particle";

export interface MonocolourParticleInfo extends ParticleInfo {
   readonly colour: ParticleColour;
}

class MonocolourParticle extends Particle {}

export default MonocolourParticle;