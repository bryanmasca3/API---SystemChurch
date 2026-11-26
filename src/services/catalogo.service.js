import BaseService from "./base.service.js";
import {
  GeneroModel,
  EstadoCivilModel,
  TipoMembresiaModel,
  EstadoModel,
  TipoReunionModel,
  RolMiembroModel,
  CategoriaInventarioModel,
  DonModel,
} from "../models/catalogo.model.js";
import { BienModel } from "../models/bien.model.js";
import { PersonaModel } from "../models/persona.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { ReunionModel } from "../models/reunion.model.js";
import { MiembroDepartamentoModel } from "../models/miembroDepartamento.model.js";

const opciones = (nombre, dependencias) => ({
  nombre,
  orden: { description: 1 },
  dependencias,
});

/** Un servicio por catálogo, indexado por el segmento de la ruta. */
export const catalogoServices = {
  genero: new BaseService(
    GeneroModel,
    opciones("Género", [{ model: PersonaModel, campo: "gender", nombre: "personas" }]),
  ),
  "estado-civil": new BaseService(
    EstadoCivilModel,
    opciones("Estado civil", [{ model: PersonaModel, campo: "civilstatus", nombre: "personas" }]),
  ),
  "tipo-membresia": new BaseService(
    TipoMembresiaModel,
    opciones("Tipo de membresía", [{ model: MiembroModel, campo: "typemembership", nombre: "miembros" }]),
  ),
  estado: new BaseService(
    EstadoModel,
    opciones("Estado", [{ model: MiembroModel, campo: "state", nombre: "miembros" }]),
  ),
  "tipo-reunion": new BaseService(
    TipoReunionModel,
    opciones("Tipo de reunión", [{ model: ReunionModel, campo: "typemeeting", nombre: "reuniones" }]),
  ),
  "rol-miembro": new BaseService(
    RolMiembroModel,
    opciones("Rol de miembro", [
      { model: MiembroDepartamentoModel, campo: "role", nombre: "integrantes de departamentos" },
    ]),
  ),
  don: new BaseService(
    DonModel,
    opciones("Don", [{ model: PersonaModel, campo: "dones", nombre: "personas con ese don" }]),
  ),
  "categoria-inventario": new BaseService(
    CategoriaInventarioModel,
    opciones("Categoría de inventario", [{ model: BienModel, campo: "categoria", nombre: "bienes del inventario" }]),
  ),
};
