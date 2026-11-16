export type ChileLocation = {
  region: string;
  cities: {
    name: string;
    communes: string[];
  }[];
};

export const CHILE_LOCATIONS: ChileLocation[] = [
  {
    region: "Arica y Parinacota",
    cities: [
      { name: "Arica", communes: ["Arica", "Camarones"] },
      { name: "Putre", communes: ["Putre", "General Lagos"] },
    ],
  },
  {
    region: "Tarapacá",
    cities: [
      { name: "Iquique", communes: ["Iquique", "Alto Hospicio"] },
      { name: "Pozo Almonte", communes: ["Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"] },
    ],
  },
  {
    region: "Antofagasta",
    cities: [
      { name: "Antofagasta", communes: ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal"] },
      { name: "Calama", communes: ["Calama", "Ollagüe", "San Pedro de Atacama"] },
      { name: "Tocopilla", communes: ["Tocopilla", "María Elena"] },
    ],
  },
  {
    region: "Atacama",
    cities: [
      { name: "Copiapó", communes: ["Copiapó", "Caldera", "Tierra Amarilla"] },
      { name: "Vallenar", communes: ["Vallenar", "Alto del Carmen", "Freirina", "Huasco"] },
      { name: "Chañaral", communes: ["Chañaral", "Diego de Almagro"] },
    ],
  },
  {
    region: "Coquimbo",
    cities: [
      { name: "La Serena", communes: ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paihuano", "Vicuña"] },
      { name: "Ovalle", communes: ["Ovalle", "Combarbalá", "Monte Patria", "Punitaqui", "Río Hurtado"] },
      { name: "Illapel", communes: ["Illapel", "Canela", "Los Vilos", "Salamanca"] },
    ],
  },
  {
    region: "Valparaíso",
    cities: [
      { name: "Valparaíso", communes: ["Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar"] },
      { name: "Quillota", communes: ["Quillota", "La Calera", "La Cruz", "Hijuelas", "Nogales"] },
      { name: "San Felipe", communes: ["San Felipe", "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María"] },
      { name: "Los Andes", communes: ["Los Andes", "Calle Larga", "Rinconada", "San Esteban"] },
      { name: "San Antonio", communes: ["San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "Santo Domingo"] },
      { name: "La Ligua", communes: ["La Ligua", "Cabildo", "Papudo", "Petorca", "Zapallar"] },
      { name: "Isla de Pascua", communes: ["Isla de Pascua"] },
    ],
  },
  {
    region: "Región Metropolitana",
    cities: [
      {
        name: "Santiago",
        communes: [
          "Santiago",
          "Cerrillos",
          "Cerro Navia",
          "Conchalí",
          "El Bosque",
          "Estación Central",
          "Huechuraba",
          "Independencia",
          "La Cisterna",
          "La Florida",
          "La Granja",
          "La Pintana",
          "La Reina",
          "Las Condes",
          "Lo Barnechea",
          "Lo Espejo",
          "Lo Prado",
          "Macul",
          "Maipú",
          "Ñuñoa",
          "Pedro Aguirre Cerda",
          "Peñalolén",
          "Providencia",
          "Pudahuel",
          "Quilicura",
          "Quinta Normal",
          "Recoleta",
          "Renca",
          "San Joaquín",
          "San Miguel",
          "San Ramón",
          "Vitacura",
        ],
      },
      { name: "Puente Alto", communes: ["Puente Alto", "Pirque", "San José de Maipo"] },
      { name: "San Bernardo", communes: ["San Bernardo", "Buin", "Calera de Tango", "Paine"] },
      { name: "Melipilla", communes: ["Melipilla", "Alhué", "Curacaví", "María Pinto", "San Pedro"] },
      { name: "Talagante", communes: ["Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Peñaflor"] },
      { name: "Colina", communes: ["Colina", "Lampa", "Tiltil"] },
    ],
  },
  {
    region: "Libertador General Bernardo O'Higgins",
    cities: [
      { name: "Rancagua", communes: ["Rancagua", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "Machalí", "Malloa", "Olivar", "Peumo", "Pichidegua", "Quinta de Tilcoco", "Requínoa", "Rengo", "San Vicente"] },
      { name: "San Fernando", communes: ["San Fernando", "Chépica", "Chimbarongo", "Lolol", "Nancagua", "Palmilla", "Peralillo", "Placilla", "Pumanque", "Santa Cruz"] },
      { name: "Pichilemu", communes: ["Pichilemu", "La Estrella", "Litueche", "Marchihue", "Navidad", "Paredones"] },
    ],
  },
  {
    region: "Maule",
    cities: [
      { name: "Talca", communes: ["Talca", "Constitución", "Curepto", "Empedrado", "Maule", "Pelarco", "Pencahue", "Río Claro", "San Clemente", "San Rafael"] },
      { name: "Curicó", communes: ["Curicó", "Hualañé", "Licantén", "Molina", "Rauco", "Romeral", "Sagrada Familia", "Teno", "Vichuquén"] },
      { name: "Linares", communes: ["Linares", "Colbún", "Longaví", "Parral", "Retiro", "San Javier", "Villa Alegre", "Yerbas Buenas"] },
      { name: "Cauquenes", communes: ["Cauquenes", "Chanco", "Pelluhue"] },
    ],
  },
  {
    region: "Ñuble",
    cities: [
      { name: "Chillán", communes: ["Chillán", "Chillán Viejo", "Bulnes", "Cobquecura", "Coelemu", "Coihueco", "El Carmen", "Ninhue", "Ñiquén", "Pemuco", "Pinto", "Portezuelo", "Quillón", "Quirihue", "Ránquil", "San Carlos", "San Fabián", "San Ignacio", "San Nicolás", "Treguaco", "Yungay"] },
    ],
  },
  {
    region: "Biobío",
    cities: [
      { name: "Concepción", communes: ["Concepción", "Chiguayante", "Coronel", "Florida", "Hualqui", "Lota", "Penco", "San Pedro de la Paz", "Santa Juana", "Talcahuano", "Tomé", "Hualpén"] },
      { name: "Los Ángeles", communes: ["Los Ángeles", "Antuco", "Cabrero", "Laja", "Mulchén", "Nacimiento", "Negrete", "Quilaco", "Quilleco", "San Rosendo", "Santa Bárbara", "Tucapel", "Yumbel", "Alto Biobío"] },
      { name: "Lebu", communes: ["Lebu", "Arauco", "Cañete", "Contulmo", "Curanilahue", "Los Álamos", "Tirúa"] },
    ],
  },
  {
    region: "La Araucanía",
    cities: [
      { name: "Temuco", communes: ["Temuco", "Carahue", "Cunco", "Curarrehue", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Saavedra", "Teodoro Schmidt", "Toltén", "Vilcún", "Villarrica", "Cholchol"] },
      { name: "Angol", communes: ["Angol", "Collipulli", "Curacautín", "Ercilla", "Lonquimay", "Los Sauces", "Lumaco", "Purén", "Renaico", "Traiguén", "Victoria"] },
    ],
  },
  {
    region: "Los Ríos",
    cities: [
      { name: "Valdivia", communes: ["Valdivia", "Corral", "Lanco", "Los Lagos", "Máfil", "Mariquina", "Paillaco", "Panguipulli"] },
      { name: "La Unión", communes: ["La Unión", "Futrono", "Lago Ranco", "Río Bueno"] },
    ],
  },
  {
    region: "Los Lagos",
    cities: [
      { name: "Puerto Montt", communes: ["Puerto Montt", "Calbuco", "Cochamó", "Fresia", "Frutillar", "Los Muermos", "Llanquihue", "Maullín", "Puerto Varas"] },
      { name: "Osorno", communes: ["Osorno", "Puerto Octay", "Purranque", "Puyehue", "Río Negro", "San Juan de la Costa", "San Pablo"] },
      { name: "Castro", communes: ["Castro", "Ancud", "Chonchi", "Curaco de Vélez", "Dalcahue", "Puqueldón", "Queilén", "Quemchi", "Quellón", "Quinchao"] },
      { name: "Chaitén", communes: ["Chaitén", "Futaleufú", "Hualaihué", "Palena"] },
    ],
  },
  {
    region: "Aysén del General Carlos Ibáñez del Campo",
    cities: [
      { name: "Coyhaique", communes: ["Coyhaique", "Lago Verde"] },
      { name: "Puerto Aysén", communes: ["Aysén", "Cisnes", "Guaitecas"] },
      { name: "Chile Chico", communes: ["Chile Chico", "Río Ibáñez"] },
      { name: "Cochrane", communes: ["Cochrane", "O'Higgins", "Tortel"] },
    ],
  },
  {
    region: "Magallanes y de la Antártica Chilena",
    cities: [
      { name: "Punta Arenas", communes: ["Punta Arenas", "Laguna Blanca", "Río Verde", "San Gregorio"] },
      { name: "Puerto Natales", communes: ["Natales", "Torres del Paine"] },
      { name: "Porvenir", communes: ["Porvenir", "Primavera", "Timaukel"] },
      { name: "Cabo de Hornos", communes: ["Cabo de Hornos", "Antártica"] },
    ],
  },
];
