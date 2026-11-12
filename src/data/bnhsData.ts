import {
  AlumniStrand,
  AnnouncementCategory,
  EventCategory,
  IndustrySector,
  MentorshipRole,
} from '../lib/firebase';

export const BNHS_ASSETS = {
  eagleCrest: '/assets/aistudio/BNHS_LOGO_animated.gif',
  officialLogoJpg: '/assets/aistudio/BNHS_LOGO_29bb7e4c.jpg',
  campusHero: '/src/assets/images/bnhs_campus_hero_1794481313686.jpg',
  homecomingEvent: '/src/assets/images/alumni_homecoming_event_1794481314683.jpg',
  mentorshipEvent: '/src/assets/images/career_mentorship_summit_1794481316060.jpg',
};

export interface PortalSettingsRecord {
  logoUrl: string;
  logoAnimated: boolean;
  heroImageUrl: string;
  schoolKicker: string;
  portalSubtitle: string;
  welcomeTitle: string;
  mottoText: string;
  welcomeDescription: string;
  directoryKicker: string;
  directoryTitle: string;
  directoryDescription: string;
  facebookUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  heroCaptionLocation: string;
  heroCaptionTitle: string;
  heroCaptionDescription: string;
  footerSubtitle: string;
  visibility?: 'public';
}

export const DEFAULT_PORTAL_SETTINGS: PortalSettingsRecord = {
  logoUrl: BNHS_ASSETS.eagleCrest,
  logoAnimated: true,
  heroImageUrl: BNHS_ASSETS.campusHero,
  schoolKicker: 'BAROBO NATIONAL HIGH SCHOOL',
  portalSubtitle: 'OFFICIAL ALUMNI PORTAL · EST. 1978 · SURIGAO DEL SUR',
  welcomeTitle: 'Welcome, BNHS Alumni!',
  mottoText: 'Once a Student, Always an Eagle!',
  welcomeDescription:
    'Reconnect. Remember. Celebrate. Stay Connected. Join the official digital home of Barobo National High School graduates from Batch 1982 to Batch 2026.',
  directoryKicker: 'Barobo National High School · Official Registry',
  directoryTitle: 'BNHS Eagle Alumni Directory',
  directoryDescription:
    'Reconnect with batch mates across decades of Barobo National High School excellence. Search by name, graduation year, senior high strand, city, or profession.',
  facebookUrl: 'https://www.facebook.com/BaroboNationalHighSchool',
  twitterUrl: 'https://twitter.com/BNHSAlumni',
  linkedinUrl: 'https://www.linkedin.com/school/barobo-national-high-school',
  heroCaptionLocation: 'Poblacion, Barobo · Surigao del Sur',
  heroCaptionTitle: 'Home of the Soaring BNHS Eagles',
  heroCaptionDescription:
    'Over five decades of academic excellence, service, and community leadership across Caraga and beyond.',
  footerSubtitle:
    'Poblacion, Barobo, Surigao del Sur · Caraga Region XIII · Once a Student, Always an Eagle!',
  visibility: 'public',
};

export interface AlumniProfileRecord {
  uid: string;
  fullName: string;
  photoUrl?: string;
  graduationYear: number;
  formerSection: string;
  strand: AlumniStrand;
  course: string;
  profession: string;
  currentEmployment: string;
  locationCity: string;
  bio: string;
  mentorshipRole: MentorshipRole;
  industrySector: IndustrySector | string;
  visibility: 'public' | 'private';
  isVerifiedRecord?: boolean;
}

export interface AlumniPrivateRecord {
  uid: string;
  email: string;
  phone: string;
  homeAddress: string;
}

export interface AlumniEventRecord {
  id: string;
  authorId: string;
  title: string;
  category: EventCategory;
  eventDate: string;
  venue: string;
  description: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'archived';
  visibility: 'public';
  imageUrl?: string;
}

export interface EventRsvpRecord {
  id: string;
  uid: string;
  eventId: string;
  attendeeName: string;
  graduationYear: number;
  status: 'attending' | 'interested' | 'cancelled';
}

export interface AnnouncementRecord {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  category: AnnouncementCategory;
  summary: string;
  content: string;
  status: 'published' | 'archived';
  visibility: 'public';
  publishedLabel?: string;
}

export interface SpotlightStoryRecord {
  id: string;
  nominatorUid: string;
  nominatorName: string;
  nomineeName: string;
  graduationYear: number;
  strand: AlumniStrand;
  profession: string;
  milestoneTitle: string;
  story: string;
  visibility: 'public';
}

export const INITIAL_ALUMNI_DIRECTORY: AlumniProfileRecord[] = [
  {
    uid: 'bnhs_alum_1998_1',
    fullName: 'Engr. Rodrigo M. Balinton',
    photoUrl: '',
    graduationYear: 1998,
    formerSection: 'IV - Rizal',
    strand: 'BEC / RBEC',
    course: 'BS Civil Engineering',
    profession: 'Senior Structural Engineer',
    currentEmployment: 'Department of Public Works and Highways (Caraga Region XIII)',
    locationCity: 'Butuan City, Agusan del Norte',
    bio: 'Forever grateful to our mentors at Bonifacio Hall who instilled discipline in mathematics and public service. Proud to help build resilient infrastructure across Surigao del Sur.',
    mentorshipRole: 'mentor',
    industrySector: 'Engineering & Architecture',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2004_2',
    fullName: 'Dr. Maricel T. Urbiztondo, MD',
    photoUrl: '',
    graduationYear: 2004,
    formerSection: 'IV - Bonifacio',
    strand: 'BEC / RBEC',
    course: 'Doctor of Medicine / BS Biology',
    profession: 'Internal Medicine Specialist',
    currentEmployment: 'Adela Serra Ty Memorial Medical Center',
    locationCity: 'Tandag City, Surigao del Sur',
    bio: 'Barobo National High School shaped my curiosity for science and community health. Always ready to support medical missions and health outreach for fellow Barobonons.',
    mentorshipRole: 'mentor',
    industrySector: 'Healthcare & Medicine',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2010_3',
    fullName: 'Atty. Kenneth J. Pimentel',
    photoUrl: '',
    graduationYear: 2010,
    formerSection: 'IV - Mabini',
    strand: 'BEC / RBEC',
    course: 'Juris Doctor / AB Political Science',
    profession: 'Public Attorney & Legal Counsel',
    currentEmployment: 'Public Attorney’s Office — Caraga',
    locationCity: 'San Francisco, Agusan del Sur',
    bio: 'Former Editor-in-Chief of The Eagle’s Quill school publication. Committed to mentoring aspiring HUMSS students in debate, journalism, and constitutional law.',
    mentorshipRole: 'mentor',
    industrySector: 'Law & Public Administration',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2015_4',
    fullName: 'Capt. Hannah Grace L. Ronquillo',
    photoUrl: '',
    graduationYear: 2015,
    formerSection: 'Grade 10 - Del Pilar',
    strand: 'SPA / SPS',
    course: 'BS Marine Transportation',
    profession: 'Second Mate / Merchant Marine Officer',
    currentEmployment: 'Maersk Line Philippines',
    locationCity: 'Barobo, Surigao del Sur',
    bio: 'From the coastal waters of Barobo Bay to international shipping lanes—once a BNHS Eagle, always soaring high.',
    mentorshipRole: 'mentor',
    industrySector: 'Maritime & Logistics',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2018_5',
    fullName: 'Christian Paul D. Sanchez, CPA',
    photoUrl: '',
    graduationYear: 2018,
    formerSection: 'Grade 12 - Pacioli',
    strand: 'ABM',
    course: 'BS Accountancy',
    profession: 'Senior Audit Associate',
    currentEmployment: 'SGV & Co. (Ernst & Young Philippines)',
    locationCity: 'Cebu City, Cebu',
    bio: 'Pioneering Senior High School ABM batch of 2018! Happy to provide CPA review guidance and internship referrals to graduating BNHS Eagles.',
    mentorshipRole: 'both',
    industrySector: 'Finance, Accounting & Business',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2019_6',
    fullName: 'Jessa Mae C. Alvizo',
    photoUrl: '',
    graduationYear: 2019,
    formerSection: 'Grade 12 - Galilei',
    strand: 'STEM',
    course: 'BS Computer Science',
    profession: 'Full-Stack Software Engineer',
    currentEmployment: 'Accenture Philippines',
    locationCity: 'Davao City, Davao del Sur',
    bio: 'Represented BNHS in the Regional Science and Technology Fair. Passionate about bringing digital literacy and software engineering workshops back to our alma mater.',
    mentorshipRole: 'mentor',
    industrySector: 'IT, Software & Cybersecurity',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2020_7',
    fullName: 'Mark Anthony V. Plaza, LPT',
    photoUrl: '',
    graduationYear: 2020,
    formerSection: 'Grade 12 - Socrates',
    strand: 'HUMSS',
    course: 'Bachelor of Secondary Education Major in English',
    profession: 'Master Teacher I',
    currentEmployment: 'DepEd Surigao del Sur Division — Barobo National High School',
    locationCity: 'Barobo, Surigao del Sur',
    bio: 'Returned home to serve the very classrooms that inspired me. Proud adviser of the BNHS Campus Journalism Guild.',
    mentorshipRole: 'both',
    industrySector: 'Education & Academe',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2021_8',
    fullName: 'Rhea Lyn G. Mordeno',
    photoUrl: '',
    graduationYear: 2021,
    formerSection: 'Grade 12 - Turing',
    strand: 'TVL-ICT',
    course: 'BS Information Systems',
    profession: 'Network & Cybersecurity Analyst',
    currentEmployment: 'Globe Telecom Enterprise Operations',
    locationCity: 'Taguig City, Metro Manila',
    bio: 'Our TVL-ICT computer laboratory sessions gave me my first hands-on server configuration skills. Grateful to the BNHS faculty!',
    mentorshipRole: 'mentee',
    industrySector: 'IT, Software & Cybersecurity',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2022_9',
    fullName: 'Chef Lorenzo B. Arreza',
    photoUrl: '',
    graduationYear: 2022,
    formerSection: 'Grade 12 - Escoffier',
    strand: 'TVL-HE',
    course: 'BS Hospitality & Culinary Management',
    profession: 'Sous Chef & Hospitality Entrepreneur',
    currentEmployment: 'Barobo Bay Coastal Kitchen & Resort',
    locationCity: 'Barobo, Surigao del Sur',
    bio: 'Championing Surigaonon seafood heritage and training BNHS TVL-Home Economics immersions right here in our hometown.',
    mentorshipRole: 'mentor',
    industrySector: 'Hospitality & Culinary Arts',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2020_10',
    fullName: 'Engr. Danica Rose S. Lumanao',
    photoUrl: '',
    graduationYear: 2020,
    formerSection: 'Grade 12 - Einstein',
    strand: 'STEM',
    course: 'BS Geodetic Engineering',
    profession: 'Licensed Geodetic Engineer',
    currentEmployment: 'DENR — PENRO Surigao del Sur',
    locationCity: 'Barobo, Surigao del Sur',
    bio: 'Batch 2020 STEM represent! Leading land survey and coastal resource mapping initiatives across Barobo and Lianga Bay.',
    mentorshipRole: 'mentee',
    industrySector: 'Engineering & Architecture',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2020_11',
    fullName: 'Katrina Mae P. Cuartero, RN',
    photoUrl: '',
    graduationYear: 2020,
    formerSection: 'Grade 12 - Einstein',
    strand: 'STEM',
    course: 'BS Nursing',
    profession: 'Emergency Room Registered Nurse',
    currentEmployment: 'Southern Philippines Medical Center',
    locationCity: 'Davao City, Davao del Sur',
    bio: 'Proud BNHS Class of 2020 alumna. Serving fellow Mindanaoans in critical care and coordinating batch medical missions.',
    mentorshipRole: 'mentee',
    industrySector: 'Healthcare & Medicine',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2020_12',
    fullName: 'John Rey M. Lampas, LPT',
    photoUrl: '',
    graduationYear: 2020,
    formerSection: 'Grade 12 - Socrates',
    strand: 'HUMSS',
    course: 'Bachelor of Secondary Education Major in Social Studies',
    profession: 'Senior High School Teacher II',
    currentEmployment: 'DepEd Surigao del Sur — Barobo National High School',
    locationCity: 'Barobo, Surigao del Sur',
    bio: 'Teaching Philippine Politics and Governance to the next generation of BNHS Eagles in my beloved alma mater.',
    mentorshipRole: 'mentee',
    industrySector: 'Education & Academe',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2018_13',
    fullName: 'Ar. Vincent Paul R. Orozco',
    photoUrl: '',
    graduationYear: 2018,
    formerSection: 'Grade 12 - Da Vinci',
    strand: 'STEM',
    course: 'BS Architecture',
    profession: 'Licensed Architect & Urban Designer',
    currentEmployment: 'Cebu Sustainable Design Studio',
    locationCity: 'Cebu City, Cebu',
    bio: 'Designed the commemorative arch proposal for the BNHS 56th Founding Anniversary. Go Pioneer Batch 2018!',
    mentorshipRole: 'mentor',
    industrySector: 'Engineering & Architecture',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2018_14',
    fullName: 'Clarisse Ann T. Millan',
    photoUrl: '',
    graduationYear: 2018,
    formerSection: 'Grade 12 - Pacioli',
    strand: 'ABM',
    course: 'BS Business Administration Major in Financial Management',
    profession: 'Commercial Relationship Manager',
    currentEmployment: 'Land Bank of the Philippines — Butuan Branch',
    locationCity: 'Butuan City, Agusan del Norte',
    bio: 'Helping Caraga agricultural cooperatives and Barobonon SMEs access sustainable financing.',
    mentorshipRole: 'mentor',
    industrySector: 'Finance, Accounting & Business',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2015_15',
    fullName: 'Engr. Aljon B. Tejero, REE',
    photoUrl: '',
    graduationYear: 2015,
    formerSection: 'Grade 10 - Luna',
    strand: 'BEC / RBEC',
    course: 'BS Electrical Engineering',
    profession: 'Registered Electrical Engineer',
    currentEmployment: 'SURSECO II (Surigao del Sur II Electric Cooperative)',
    locationCity: 'Tandag City, Surigao del Sur',
    bio: 'Ensuring reliable power distribution across Surigao del Sur municipalities including our hometown of Barobo.',
    mentorshipRole: 'both',
    industrySector: 'Engineering & Architecture',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2015_16',
    fullName: 'Camille Joy E. Navarro',
    photoUrl: '',
    graduationYear: 2015,
    formerSection: 'Grade 10 - Del Pilar',
    strand: 'SPA / SPS',
    course: 'BA Communication Arts',
    profession: 'Senior Digital Communications Specialist',
    currentEmployment: 'Bonifacio Global Media Collective',
    locationCity: 'Taguig City, Metro Manila',
    bio: 'Managing digital outreach for the BNHS Metro Manila Alumni Chapter and annual homecoming livestreams.',
    mentorshipRole: 'mentee',
    industrySector: 'Finance, Accounting & Business',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2021_17',
    fullName: 'Joshua C. Magallanes',
    photoUrl: '',
    graduationYear: 2021,
    formerSection: 'Grade 12 - Turing',
    strand: 'TVL-ICT',
    course: 'BS Information Technology',
    profession: 'Cloud Systems Administrator',
    currentEmployment: 'Davao Tech Hub Solutions',
    locationCity: 'Davao City, Davao del Sur',
    bio: 'Batch 2021 TVL-ICT graduate! Always excited to mentor BNHS students interested in cloud computing and DevOps.',
    mentorshipRole: 'both',
    industrySector: 'IT, Software & Cybersecurity',
    visibility: 'public',
  },
  {
    uid: 'bnhs_alum_2010_18',
    fullName: 'Dr. Sheila Mae D. Falcon, LPT',
    photoUrl: '',
    graduationYear: 2010,
    formerSection: 'IV - Mabini',
    strand: 'BEC / RBEC',
    course: 'Doctor of Philosophy in Science Education',
    profession: 'University Associate Professor',
    currentEmployment: 'Caraga State University (CSU)',
    locationCity: 'Butuan City, Agusan del Norte',
    bio: 'Guiding Barobo National High School graduates pursuing STEM and education degrees at Caraga State University.',
    mentorshipRole: 'mentor',
    industrySector: 'Education & Academe',
    visibility: 'public',
  },
];

export const INITIAL_SPOTLIGHT_STORIES: SpotlightStoryRecord[] = [
  {
    id: 'spot_balinton_1998',
    nominatorUid: 'system_bnhs_admin',
    nominatorName: 'BNHS Alumni Federation',
    nomineeName: 'Engr. Rodrigo M. Balinton',
    graduationYear: 1998,
    strand: 'BEC / RBEC',
    profession: 'Senior Structural Engineer · DPWH Caraga',
    milestoneTitle: 'Spearheaded 14 Resilient Coastal Bridges Across Surigao del Sur',
    story:
      'After graduating from IV-Rizal at Barobo National High School in 1998, Engr. Balinton led structural retrofitting and typhoon-resilient bridge engineering across Caraga Region XIII, mentoring over 25 young Barobonon civil engineers entering public service.',
    visibility: 'public',
  },
  {
    id: 'spot_urbiztondo_2004',
    nominatorUid: 'system_bnhs_admin',
    nominatorName: 'Batch 2004 Chapter',
    nomineeName: 'Dr. Maricel T. Urbiztondo, MD',
    graduationYear: 2004,
    strand: 'BEC / RBEC',
    profession: 'Internal Medicine Specialist · ASTMMC Tandag',
    milestoneTitle: 'Founded the Annual Barobo Bay Community Medical & Diagnostics Caravan',
    story:
      'Dr. Urbiztondo has organized 12 consecutive rural health outreach caravans in Barobo and neighboring coastal barangays, providing free cardiovascular screenings, medicines, and clinical mentorship to aspiring BNHS STEM pre-med scholars.',
    visibility: 'public',
  },
  {
    id: 'spot_alvizo_2019',
    nominatorUid: 'system_bnhs_admin',
    nominatorName: 'BNHS STEM Department',
    nomineeName: 'Jessa Mae C. Alvizo',
    graduationYear: 2019,
    strand: 'STEM',
    profession: 'Full-Stack Software Engineer · Accenture Philippines',
    milestoneTitle: 'National Hackathon Finalist & Founder of BNHS Coding Bootcamp',
    story:
      'A proud product of Grade 12 - Galilei, Jessa launched a weekend web development and robotics mentorship program for Barobo National High School STEM and TVL-ICT learners, helping 18 students secure university computing scholarships.',
    visibility: 'public',
  },
  {
    id: 'spot_ronquillo_2015',
    nominatorUid: 'system_bnhs_admin',
    nominatorName: 'Batch 2015 Decade Committee',
    nomineeName: 'Capt. Hannah Grace L. Ronquillo',
    graduationYear: 2015,
    strand: 'SPA / SPS',
    profession: 'Merchant Marine Officer · Maersk Line',
    milestoneTitle: 'Among the Youngest Female Navigation Officers on Trans-Pacific Routes',
    story:
      'From Barobo Bay to global container vessels, Capt. Ronquillo champions women in maritime leadership and sponsors navigation instruments and stipends for BNHS graduates entering maritime academies.',
    visibility: 'public',
  },
];

export const INITIAL_EVENTS: AlumniEventRecord[] = [
  {
    id: 'event_grand_homecoming_2027',
    authorId: 'system_bnhs_admin',
    title: 'Grand Alumni Homecoming Gala & Parade of Batches',
    category: 'Homecoming',
    eventDate: 'March 20, 2027 · 4:00 PM PST',
    venue: 'BNHS Grand Quadrangle & Covered Court, Poblacion, Barobo',
    description:
      'Gather with fellow Eagles across five decades of Barobo National High School excellence. The evening features the Parade of Batches, Jubilarian Medallion Conferment, Cultural Showcase by the BNHS Performing Arts Guild, and the Alumni Legacy Pledging Dinner.',
    status: 'upcoming',
    visibility: 'public',
    imageUrl: BNHS_ASSETS.homecomingEvent,
  },
  {
    id: 'event_eagle_career_summit_2026',
    authorId: 'system_bnhs_admin',
    title: 'Annual Eagle Career Mentorship & Senior High Immersion Forum',
    category: 'Career Mentorship',
    eventDate: 'December 12, 2026 · 8:30 AM PST',
    venue: 'BNHS Audio-Visual Auditorium, Barobo Campus',
    description:
      'Alumni professionals from Engineering, Medicine, Law, Information Technology, Maritime, and Entrepreneurship return to mentor Grade 11 and Grade 12 STEM, ABM, HUMSS, GAS, and TVL students preparing for college admissions and work immersion.',
    status: 'upcoming',
    visibility: 'public',
    imageUrl: BNHS_ASSETS.mentorshipEvent,
  },
  {
    id: 'event_silver_jubilarian_2002',
    authorId: 'system_bnhs_admin',
    title: 'Class of 2002 Silver Jubilarian Batch Reunion & Turn-Over',
    category: 'Batch Reunion',
    eventDate: 'January 16, 2027 · 1:00 PM PST',
    venue: 'Bonifacio Hall Alumni Conference Room & Campus Pavilion',
    description:
      'Batch 2002 Silver Jubilarians convene to finalize the Solar-Powered Digital Library Kiosk donation project and coordinate batch choreography and sponsorship tiers for the March Grand Homecoming.',
    status: 'upcoming',
    visibility: 'public',
    imageUrl: BNHS_ASSETS.campusHero,
  },
  {
    id: 'event_scholarship_drive_2026',
    authorId: 'system_bnhs_admin',
    title: 'Once an Eagle Scholarship Endowment & Book Drive',
    category: 'Scholarship Drive',
    eventDate: 'November 28, 2026 · 9:00 AM PST',
    venue: 'BNHS Main Library & Online Alumni Portal',
    description:
      'Supporting 35 deserving Barobonon senior high school graduates entering state universities across Caraga and Mindanao with book stipends, scientific calculators, and dormitory allowances.',
    status: 'ongoing',
    visibility: 'public',
    imageUrl: BNHS_ASSETS.mentorshipEvent,
  },
  {
    id: 'event_coastal_outreach_2027',
    authorId: 'system_bnhs_admin',
    title: 'Barobo Bay Mangrove Planting & Medical Community Outreach',
    category: 'Community Outreach',
    eventDate: 'February 14, 2027 · 6:30 AM PST',
    venue: 'Barobo Coastal Barangay Sanctuary & Municipal Gymnasium',
    description:
      'Join BNHS alumni doctors, nurses, engineers, and batch volunteers for a morning mangrove reforestation drive along Barobo Bay followed by a free community medical and dental outreach.',
    status: 'upcoming',
    visibility: 'public',
    imageUrl: BNHS_ASSETS.campusHero,
  },
];

export const INITIAL_ANNOUNCEMENTS: AnnouncementRecord[] = [
  {
    id: 'ann_digital_registry_launch',
    authorId: 'system_bnhs_admin',
    authorName: 'BNHS Alumni Federation Board of Trustees',
    title: 'Official Launch of the Centralized BNHS Alumni Digital Registry & Directory',
    category: 'Official Bulletin',
    summary:
      'All former students from Batch 1982 to the present graduating class are invited to verify their academic records, update employment milestones, and connect with batchmates.',
    content:
      'The BNHS Alumni Federation in partnership with the Office of the School Principal proudly launches our centralized online Alumni Portal. Former students from the Basic Education Curriculum (BEC/RBEC), Special Programs (SPA/SPS), and Senior High School tracks (STEM, ABM, HUMSS, GAS, and TVL) can now register online with their profile photo, batch year, former section, degree, profession, and mentorship opt-in.',
    status: 'published',
    visibility: 'public',
    publishedLabel: 'November 2026',
  },
  {
    id: 'ann_eagle_scholars_ay2026',
    authorId: 'system_bnhs_admin',
    authorName: 'Alumni Scholarship & Grants Committee',
    title: 'Call for Nominations: 2027 BNHS Eagle College Entrance Stipend Program',
    category: 'Scholarship Grant',
    summary:
      'Applications and alumni sponsorships are now open for graduating Grade 12 students taking STEM, Education, Agriculture, and Healthcare degree programs.',
    content:
      'The BNHS Alumni Scholarship Endowment Fund has opened nominations for the Academic Year 2027–2028 cohort. Twenty (20) graduating Grade 12 students from Barobo National High School with exemplary academic standing and community leadership will receive a semesterly allowance and laptop grant.',
    status: 'published',
    visibility: 'public',
    publishedLabel: 'November 2026',
  },
  {
    id: 'ann_science_wing_modernization',
    authorId: 'system_bnhs_admin',
    authorName: 'Campus Development & Linkages Office',
    title: 'Phase II Completion of the Alumni-Funded STEM & Robotics Laboratory Wing',
    category: 'Campus Development',
    summary:
      'New optical microscopes, Arduino robotics kits, and fiber-optic internet workstations donated by Batches 1995–2015 are now operational.',
    content:
      'Thanks to the collective generosity of our domestic and overseas BNHS alumni chapters, Phase II of the Science and ICT Laboratory modernization is now complete. Over 420 Junior and Senior High School learners now utilize the upgraded workstations daily for research capstone projects and regional science competitions.',
    status: 'published',
    visibility: 'public',
    publishedLabel: 'October 2026',
  },
  {
    id: 'ann_board_topnotchers_recognition',
    authorId: 'system_bnhs_admin',
    authorName: 'Office of the School Principal',
    title: 'Commendation for BNHS Alumni Licensure Examination Topnotchers & New Professionals',
    category: 'Batch Milestone',
    summary:
      'Honoring 68 newly licensed Engineers, Teachers, Nurses, CPAs, and Master Electricians from recent graduating classes.',
    content:
      'Barobo National High School extends its warmest congratulations to the 68 alumni who recently passed their respective Professional Regulation Commission (PRC) licensure examinations, including three national topnotchers in the Licensure Examination for Professional Teachers (LEPT) and Civil Engineering Licensure Exam.',
    status: 'published',
    visibility: 'public',
    publishedLabel: 'October 2026',
  },
];
