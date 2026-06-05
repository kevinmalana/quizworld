#!/usr/bin/env node
// seed-aws-quizzes.js
// Seeds AWS certification practice quizzes by calling the live AI API
// then inserting directly into Supabase

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.argv[2]; // pass as first arg

if (!SERVICE_ROLE_KEY) {
  console.error("Usage: node seed-aws-quizzes.js <SUPABASE_SERVICE_ROLE_KEY>");
  process.exit(1);
}

const TAYLOR_BROOKS_ID = "008e12cd-733e-427e-a40b-8815e4d88652";

const AWS_EXAMS = [
  {
    title: "AWS Cloud Practitioner (CLF-C02) Practice Exam",
    category: "Technology",
    description: "Full-length AWS Certified Cloud Practitioner practice exam covering cloud concepts, security, technology, and billing. 65 questions aligned to CLF-C02 exam objectives.",
    sourceText: `AWS Certified Cloud Practitioner (CLF-C02) Exam Guide

DOMAIN 1: Cloud Concepts (24%)
- Define the benefits of the AWS Cloud: scalability, elasticity, agility, high availability, pay-as-you-go pricing, global reach
- Identify AWS cloud economics: OpEx vs CapEx, Total Cost of Ownership (TCO), AWS Pricing Calculator
- Explain different cloud architecture design principles: fault tolerance, high availability, disaster recovery
- Describe the AWS shared responsibility model

DOMAIN 2: Security and Compliance (30%)
- AWS Identity and Access Management (IAM): users, groups, roles, policies, MFA
- AWS security services: AWS Shield, AWS WAF, Amazon GuardDuty, AWS Inspector, AWS Macie
- Data protection: encryption at rest and in transit, AWS KMS, AWS CloudHSM
- Compliance: AWS Artifact, AWS Compliance programs, GDPR, HIPAA

DOMAIN 3: Cloud Technology and Services (34%)
- AWS global infrastructure: Regions, Availability Zones, Edge Locations, Local Zones
- Compute services: EC2 instance types, Lambda, ECS, EKS, Elastic Beanstalk, Lightsail
- Storage services: S3 storage classes, EBS, EFS, S3 Glacier, AWS Storage Gateway
- Database services: RDS, DynamoDB, ElastiCache, Redshift, Aurora
- Networking: VPC, subnets, security groups, NACLs, Route 53, CloudFront, Direct Connect
- Developer tools: CodeCommit, CodeBuild, CodeDeploy, CodePipeline, Cloud9

DOMAIN 4: Billing, Pricing, and Support (12%)
- AWS pricing models: On-Demand, Reserved Instances, Spot Instances, Savings Plans
- AWS Free Tier: always free, 12 months free, short-term trials
- AWS Support plans: Basic, Developer, Business, Enterprise
- AWS Cost Management tools: Cost Explorer, AWS Budgets, Cost and Usage Report
- AWS Organizations and consolidated billing`,
    questionCount: 65,
  },
  {
    title: "AWS Solutions Architect Associate (SAA-C03) Practice Exam",
    category: "Technology",
    description: "Full-length AWS Certified Solutions Architect Associate practice exam. 65 scenario-based questions covering design, resilience, performance, cost optimisation and security aligned to SAA-C03.",
    sourceText: `AWS Certified Solutions Architect Associate (SAA-C03) Exam Guide

DOMAIN 1: Design Secure Architectures (30%)
- IAM roles, policies, permission boundaries, SCP in AWS Organizations
- S3 bucket policies, ACLs, encryption (SSE-S3, SSE-KMS, SSE-C), presigned URLs
- VPC design: public/private subnets, NAT Gateway vs NAT Instance, VPC peering, Transit Gateway
- Security groups vs NACLs, AWS WAF, AWS Shield Advanced
- AWS Secrets Manager vs Parameter Store, KMS key policies
- CloudTrail, VPC Flow Logs, Config rules for compliance

DOMAIN 2: Design Resilient Architectures (26%)
- Multi-AZ vs Multi-Region deployments
- RDS Multi-AZ, Aurora Global Database, DynamoDB global tables
- Auto Scaling groups: target tracking, step scaling, scheduled scaling
- Elastic Load Balancing: ALB, NLB, CLB - use cases and differences
- Route 53 routing policies: failover, latency, weighted, geolocation, multivalue
- Disaster recovery: RTO/RPO, backup/restore, pilot light, warm standby, multi-site active/active
- SQS, SNS, EventBridge for decoupled architectures

DOMAIN 3: Design High-Performing Architectures (24%)
- EC2 instance types: compute optimised, memory optimised, storage optimised, accelerated computing
- EBS volume types: gp3, io2, st1, sc1 - IOPS and throughput
- S3 performance: multipart upload, Transfer Acceleration, S3 Select
- CloudFront caching, Lambda@Edge, Global Accelerator
- ElastiCache Redis vs Memcached, DAX for DynamoDB
- EFS vs FSx, S3 vs EBS vs EFS decision framework
- Kinesis Data Streams vs Firehose vs Analytics

DOMAIN 4: Design Cost-Optimised Architectures (20%)
- EC2 pricing: On-Demand, Reserved (Standard/Convertible), Spot, Dedicated Hosts
- S3 storage classes and lifecycle policies
- Serverless vs server-based cost comparison: Lambda, Fargate
- Data transfer costs, CloudFront to reduce egress
- AWS Cost Explorer, Trusted Advisor cost recommendations`,
    questionCount: 65,
  },
  {
    title: "AWS Developer Associate (DVA-C02) Practice Exam",
    category: "Technology",
    description: "Full-length AWS Certified Developer Associate practice exam. 65 questions covering Lambda, DynamoDB, API Gateway, CI/CD, and AWS SDK aligned to DVA-C02.",
    sourceText: `AWS Certified Developer Associate (DVA-C02) Exam Guide

DOMAIN 1: Development with AWS Services (32%)
- AWS Lambda: event sources, execution environment, layers, concurrency, cold starts, provisioned concurrency
- API Gateway: REST vs HTTP vs WebSocket APIs, stages, throttling, caching, Lambda proxy integration
- DynamoDB: partition keys, sort keys, GSI, LSI, read/write capacity, DynamoDB Streams, TTL
- S3: presigned URLs, event notifications, CORS, multipart upload, versioning
- SQS: standard vs FIFO, visibility timeout, dead letter queues, long polling
- SNS: topics, subscriptions, fan-out pattern, message filtering
- Kinesis: shards, partition keys, consumers, enhanced fan-out
- Step Functions: state machine, task states, error handling

DOMAIN 2: Security (26%)
- IAM roles for Lambda, EC2, ECS task roles
- Cognito User Pools vs Identity Pools, JWT tokens
- AWS KMS: envelope encryption, data keys, CMK
- Secrets Manager vs Parameter Store for credentials
- API Gateway authorizers: Lambda authorizer, Cognito authorizer

DOMAIN 3: Deployment (24%)
- CodeCommit, CodeBuild buildspec.yml, CodeDeploy appspec.yml
- CodePipeline stages and actions
- Elastic Beanstalk deployment policies: all at once, rolling, rolling with batch, immutable, blue/green
- CloudFormation: templates, stacks, change sets, drift detection, SAM
- ECS: task definitions, services, Fargate vs EC2 launch type
- Lambda deployment: aliases, versions, traffic shifting with weighted aliases

DOMAIN 4: Troubleshooting and Optimisation (18%)
- CloudWatch Logs, Metrics, Alarms, X-Ray tracing
- Lambda performance: memory allocation, timeout, reserved concurrency
- DynamoDB performance: hot partition problem, exponential backoff
- API Gateway throttling: 429 errors, usage plans
- Elastic Beanstalk health monitoring, environment tiers`,
    questionCount: 65,
  },
];

async function generateQuestions(exam) {
  console.log(`\nGenerating questions for: ${exam.title}`);
  
  const res = await fetch("https://www.quizworld.xyz/api/ai-source-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceText: exam.sourceText,
      sourceTitle: exam.title,
      sourceLabel: "AWS Official Exam Guide",
      questionCount: exam.questionCount,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.draft || !data.draft.questions) {
    throw new Error("No questions in response: " + JSON.stringify(data));
  }

  console.log(`  ✓ Generated ${data.draft.questions.length} questions`);
  return data.draft.questions;
}

async function insertQuiz(exam, questions) {
  const headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  };

  // Insert quiz
  const quizRes = await fetch(`${SUPABASE_URL}/rest/v1/quizzes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: exam.title,
      category: exam.category,
      emoji: "☁️",
      color: "#0ea5e9",
      is_public: true,
      creator_id: TAYLOR_BROOKS_ID,
    }),
  });

  if (!quizRes.ok) {
    const err = await quizRes.text();
    throw new Error(`Quiz insert failed: ${err}`);
  }

  const [quiz] = await quizRes.json();
  console.log(`  ✓ Created quiz: ${quiz.id}`);

  // Insert questions + answers
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    const qRes = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        quiz_id: quiz.id,
        text: q.text,
        time_limit: q.time_limit || 30,
        points: q.points || 1000,
        order_index: i,
      }),
    });

    if (!qRes.ok) {
      const err = await qRes.text();
      throw new Error(`Question insert failed: ${err}`);
    }

    const [question] = await qRes.json();

    // Insert answers
    const answers = q.answers || [];
    for (const a of answers) {
      const aRes = await fetch(`${SUPABASE_URL}/rest/v1/answers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          question_id: question.id,
          text: a.text,
          is_correct: a.is_correct,
        }),
      });
      if (!aRes.ok) {
        const err = await aRes.text();
        throw new Error(`Answer insert failed: ${err}`);
      }
    }

    if ((i + 1) % 10 === 0) console.log(`  ✓ Inserted ${i + 1}/${questions.length} questions`);
  }

  console.log(`  ✅ Quiz fully seeded: ${exam.title}`);
  return quiz;
}

async function main() {
  console.log("🚀 Starting AWS quiz seeding...");
  console.log(`   Supabase: ${SUPABASE_URL}`);

  for (const exam of AWS_EXAMS) {
    try {
      const questions = await generateQuestions(exam);
      await insertQuiz(exam, questions);
      // Small delay between exams
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  ❌ Failed: ${exam.title}`, err.message);
    }
  }

  console.log("\n✅ Done! Verify at https://www.quizworld.xyz/explore");
}

main();
