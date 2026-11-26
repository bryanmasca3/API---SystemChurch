import BaseService from "./base.service.js";
import { AdherenteModel } from "../models/adherente.model.js";
import { MiembroModel } from "../models/miembro.model.js";
import { PersonaModel } from "../models/persona.model.js";

class AdherenteService extends BaseService {
  constructor() {
    super(AdherenteModel, {
      nombre: "Adherente",
      orden: { createdAt: -1 },
      paginado: true,
      populate: ["person", { path: "relation", populate: { path: "person" } }],
      referencias: [
        { campo: "relation", model: MiembroModel, nombre: "miembro que invitó" },
        { campo: "person", model: PersonaModel, nombre: "persona" },
      ],
    });
  }
}

export default AdherenteService;
