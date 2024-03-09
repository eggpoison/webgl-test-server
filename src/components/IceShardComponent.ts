import { IceShardComponentData } from "webgl-test-shared";
import Entity from "../Entity";

export interface IceShardComponent {
   readonly lifetime: number;
}

export function serialiseIceShardComponent(_entity: Entity): IceShardComponentData {
   return {};
}