const yearsSince = (startYear: number) => new Date().getFullYear() - startYear;

export const physicianProfileYears = {
  patientCareStart: 1989,
  functionalMedicineStart: 1998,
  idahoRelocation: 2022,
} as const;

export const physicianProfileExperience = {
  patientCare: `${yearsSince(physicianProfileYears.patientCareStart)}+ years`,
  functionalMedicine: `${yearsSince(physicianProfileYears.functionalMedicineStart)} years`,
  certifiedFunctionalMedicine: "more than 25 years",
  neckProlotherapy: "more than 26 years",
  seattlePractice: "33 years",
  bastyrFaculty: "16 years",
} as const;
