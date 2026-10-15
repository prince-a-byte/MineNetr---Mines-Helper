from sqlalchemy.orm import Session

from app import models

from app.auth import hash_pw



DEMO_USERS = [

  dict(name="Amit Verma", email="dgms@minenetr.in", pw="dgms123", role="dgms", title="Main Administrator (DGMS)", org="DGMS"),

  dict(name="Rajesh Kumar", email="inspector@minenetr.in", pw="inspect123", role="inspector", title="Senior Mine Inspector (DGMS)", org="DGMS", mine_code="BCM-03"),

  dict(name="Vikram Singh", email="operator@minenetr.in", pw="operate123", role="operator", title="Mine Manager", org="BCCL", mine_code="BCM-03"),

  dict(name="Rakesh Kumar", email="contractor@minenetr.in", pw="contract123", role="contractor", title="Contractor Admin", org="ABC Mining Services", contractor_id="CTR-01"),

]



MINES = [

  ("BCM-01","North Karanpura Mine","Jharkhand","Ramgarh","CCL","Opencast","Active","Medium","8.5 MTPA","12 Sep 2026"),

  ("BCM-02","Block II Project","Chhattisgarh","Korba","SECL","Underground","Active","High","6.0 MTPA","08 Sep 2026"),

  ("BCM-03","Bharat Coal Mine","Jharkhand","Dhanbad","BCCL","Opencast","Active","Medium","12.5 MTPA","03 Oct 2026"),

  ("BCM-04","Gevra Mine","Chhattisgarh","Korba","SECL","Opencast","Active","High","52 MTPA","21 Sep 2026"),

  ("BCM-05","Kusmunda Mine","Chhattisgarh","Korba","SECL","Opencast","Active","High","50 MTPA","18 Sep 2026"),

  ("BCM-06","Talcher Mine","Odisha","Angul","MCL","Opencast","Active","Medium","20 MTPA","25 Sep 2026"),

  ("BCM-07","IB Valley Mine","Odisha","Jharsuguda","MCL","Opencast","Under Inspection","High","22 MTPA","02 Oct 2026"),

  ("BCM-08","Singrauli Mine","Madhya Pradesh","Singrauli","NCL","Opencast","Active","Medium","18 MTPA","15 Sep 2026"),

  ("BCM-09","Mand-Raigarh","Chhattisgarh","Raigarh","SECL","Opencast","Active","Low","15 MTPA","28 Sep 2026"),

  ("BCM-10","Sohagpur Mine","Madhya Pradesh","Shahdol","NCL","Underground","Inactive","Low","4 MTPA","10 Aug 2026"),

  ("BCM-11","Lakhanpur Mine","Odisha","Jharsuguda","MCL","Opencast","Active","Medium","20 MTPA","24 Sep 2026"),

  ("BCM-12","Korba West Mine","Chhattisgarh","Korba","SECL","Opencast","Active","Medium","12 MTPA","20 Sep 2026"),

],



INSPECTIONS = [

  ("INS-2026-214","BCM-03","Bharat Coal Mine","Jharkhand","Rajesh Kumar","inspector@minenetr.in","03 Oct 2026","Routine","Completed","Submitted","High"),

  ("INS-2026-213","BCM-04","Gevra Mine","Chhattisgarh","Sunil Prakash","","02 Oct 2026","Safety","In Progress","-","Critical"),

  ("INS-2026-212","BCM-06","Talcher Mine","Odisha","Amit Gupta","","01 Oct 2026","Environmental","Completed","Pending Review","Medium"),

  ("INS-2026-211","BCM-05","Kusmunda Mine","Chhattisgarh","Neha Patel","","30 Sep 2026","Routine","Overdue","Not Submitted","High"),

  ("INS-2026-210","BCM-07","IB Valley Mine","Odisha","Vivek Singh","","29 Sep 2026","Safety","Completed","Submitted","Critical"),

  ("INS-2026-209","BCM-09","Mand-Raigarh","Chhattisgarh","Rajesh Kumar","inspector@minenetr.in","28 Sep 2026","Routine","In Progress","-","Medium"),

  ("INS-2026-208","BCM-08","Singrauli Mine","Madhya Pradesh","Sunil Prakash","","27 Sep 2026","Environmental","Completed","Submitted","Medium"),

  ("INS-2026-207","BCM-01","North Karanpura","Jharkhand","Amit Gupta","","26 Sep 2026","Safety","Overdue","Not Submitted","High"),

  ("INS-2026-206","BCM-02","Block II Project","Chhattisgarh","Neha Patel","","25 Sep 2026","Routine","Completed","Submitted","Low"),

  ("INS-2026-205","BCM-11","Lakhanpur Mine","Madhya Pradesh","Vivek Singh","","24 Sep 2026","Special","In Progress","-","Medium"),

]



FINDINGS = [

  ("FND-2026-482","Bharat Coal Mine","BCM-03","Jharkhand","Safety (PPE)","Critical","Open","AI Detection","AI-detected: Missing PPE in loading area","Pit Area - Loading Point L3","03 Oct 2026","Mine Operator (Bharat Coking Coal Ltd.)","10 Oct 2026",0.94),

  ("FND-2026-481","Gevra Mine","BCM-04","Chhattisgarh","Environment","High","In Progress","Inspector","High dust level detected near haul road","Haul Road H2","02 Oct 2026","Mine Operator (SECL)","09 Oct 2026",0),

  ("FND-2026-480","Talcher Mine","BCM-06","Odisha","Equipment Safety","Medium","Open","Inspector","Conveyor guard missing in section B","Conveyor B","02 Oct 2026","Mine Operator (MCL)","12 Oct 2026",0),

  ("FND-2026-479","Kusmunda Mine","BCM-05","Chhattisgarh","Documentation","High","Open","AI Detection","Expired explosive storage license","Magazine Store","01 Oct 2026","Mine Operator (SECL)","08 Oct 2026",0.88),

  ("FND-2026-478","IB Valley Mine","BCM-07","Odisha","Safety (PPE)","Critical","In Progress","Inspector","Methane level above threshold in Panel 2","Panel 2","30 Sep 2026","Mine Operator (MCL)","07 Oct 2026",0),

  ("FND-2026-477","Mand-Raigarh","BCM-09","Chhattisgarh","Worker Welfare","Medium","Resolved","Inspector","Drinking water facility inadequate","Camp C1","28 Sep 2026","Contractor (ABC)","05 Oct 2026",0),

  ("FND-2026-476","North Karanpura","BCM-01","Jharkhand","Environment","High","Open","Sensor Alert","PM10 above threshold for 3 consecutive readings","Sensor S-12","26 Sep 2026","Mine Operator (CCL)","06 Oct 2026",0),

  ("FND-2026-475","Lakhanpur Mine","BCM-11","Madhya Pradesh","Equipment Safety","Medium","In Progress","AI Detection","Dumper without reverse horn detected","Pit Edge","24 Sep 2026","Mine Operator (MCL)","11 Oct 2026",0.81),
]