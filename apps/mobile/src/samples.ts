import type { Pack } from './study/types';
// Existing repository-authored seed content, without its synthetic popularity counts.
// Source: scripts/seed-supabase.js DEFAULT_QUIZZES. No seed script is executed.
export const samples: Pack[] = [{
  id:'sample-geography', revision:'seed-geography-v1', title:'World Geography Basics', category:'Geography', source:'bundled', sourceLabel:'QuizWorld repository sample · not an exam-prep pack',
  questions:[
    {id:'geo-1',text:'Which is the largest continent by area?',answers:[{id:'geo-1-a',text:'Africa',is_correct:false},{id:'geo-1-b',text:'Asia',is_correct:true},{id:'geo-1-c',text:'North America',is_correct:false},{id:'geo-1-d',text:'Europe',is_correct:false}]},
    {id:'geo-2',text:'What is the capital of Japan?',answers:[{id:'geo-2-a',text:'Seoul',is_correct:false},{id:'geo-2-b',text:'Beijing',is_correct:false},{id:'geo-2-c',text:'Tokyo',is_correct:true},{id:'geo-2-d',text:'Osaka',is_correct:false}]},
  ],
},{
  id:'sample-culture', revision:'seed-culture-v1', title:'90s Pop Culture', category:'Entertainment', source:'bundled', sourceLabel:'QuizWorld repository sample · not an exam-prep pack',
  questions:[
    {id:'pop-1',text:'Which console was released by Nintendo in 1996?',answers:[{id:'pop-1-a',text:'SNES',is_correct:false},{id:'pop-1-b',text:'Nintendo 64',is_correct:true},{id:'pop-1-c',text:'GameCube',is_correct:false},{id:'pop-1-d',text:'Wii',is_correct:false}]},
    {id:'pop-2',text:"What movie features the quote 'There's no crying in baseball!'?",answers:[{id:'pop-2-a',text:'A League of Their Own',is_correct:true},{id:'pop-2-b',text:'Field of Dreams',is_correct:false},{id:'pop-2-c',text:'Rookie of the Year',is_correct:false},{id:'pop-2-d',text:'Bull Durham',is_correct:false}]},
  ],
}];
